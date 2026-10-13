/**
 * Headless sweep. Runs against the built site, at 390px and at desktop width.
 *
 * The contrast probe composites the real painted background rather than reading
 * the declared colour, so opacity variants and tinted panels are measured as
 * they are actually seen.
 */
import { chromium } from 'playwright-core'
import { globSync } from 'node:fs'

const [exe] = globSync(`${process.env.HOME}/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`)
const BASE = process.env.BASE ?? 'http://127.0.0.1:4330'

let bad = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++ }

const browser = await chromium.launch({ executablePath: exe })

const CONTRAST = `(() => {
  const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const lum = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)
  const parse = s => {
    const m = s.match(/[\\d.]+/g)
    if (!m) return null
    return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]
  }
  const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]))
  const bgOf = el => {
    let stack = [], n = el
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c[3] > 0) { stack.push(c); if (c[3] === 1) break }
      n = n.parentElement
    }
    let base = [255, 255, 255]
    for (const c of stack.reverse()) base = over(c, base)
    return base
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const out = []
  for (const el of document.querySelectorAll('*')) {
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('')
    if (!text) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const fg = parse(s.color)
    const painted = fg[3] < 1 ? over(fg, bgOf(el)) : fg.slice(0, 3)
    const px = parseFloat(s.fontSize)
    const large = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700)
    const need = large ? 3 : 4.5
    const cr = ratio(painted, bgOf(el))
    if (cr < need) out.push({ text: text.slice(0, 44), cr: +cr.toFixed(2), need, px, sel: el.tagName + '.' + el.className })
  }
  return out
})()`

for (const [label, width, height] of [['mobile 390', 390, 844], ['desktop 1280', 1280, 900]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(BASE, { waitUntil: 'load' })

  console.log(`\n=== ${label} ===`)

  const T = s => page.locator(`text=${s}`).first()
  const sw = name => page.getByRole('switch', { name })

  // default state: one fault on, and the status band still says 200
  ok(await page.locator('text=200 OK').first().isVisible(), 'the status band shows 200 OK')
  ok(await T('2 of 7 fields empty').isVisible(), 'and says 2 of 7 fields empty')
  ok(await page.locator('text=specs.table returned null').first().isVisible(), 'the specification block names the empty field')
  ok(await page.locator('table').count() === 0, 'and no specification table is rendered')
  ok(await page.locator('text=Looking after reactive glaze').first().isVisible(), 'while the care guide still renders, which is the confusing part')

  // clear every fault
  await page.getByRole('button', { name: 'Clear' }).click()
  ok(await T('0 of 7 fields empty').isVisible(), 'cleared, nothing is empty')
  ok(await page.locator('table tbody tr').count() === 9, '9 specification rows arrive')
  ok((await page.locator('ul li').filter({ hasText: 'Unglazed foot ring' }).count()) > 0, 'the features list arrives')
  ok(await page.locator('text=Etruria marl, Staffordshire').first().isVisible(), 'the materials metaobject arrives')

  // one draft entry
  await sw('Metaobject entry left in draft').click()
  ok(await page.locator('text=metaobject care_guide returned null').first().isVisible(), 'a draft entry empties the care guide')
  ok(await page.locator('text=Etruria marl, Staffordshire').first().isVisible(), 'and leaves the material alone, which is why it gets called intermittent')
  ok(await page.locator('table tbody tr').count() === 9, 'and leaves the specifications alone')
  await sw('Metaobject entry left in draft').click()

  // token scope
  await sw('Storefront token missing the metaobject scope').click()
  ok(await page.locator('text=metaobject care_guide returned null').first().isVisible(), 'a missing scope empties the care guide')
  ok(await page.locator('text=metaobject material returned null').first().isVisible(), 'and the material')
  ok(await page.locator('table tbody tr').count() === 9, 'while the product fields keep working, so the integration looks alive')
  await sw('Storefront token missing the metaobject scope').click()

  // the cache, the only fault that shows wrong data
  await sw('WordPress serving a cached copy').click()
  ok(await page.locator('text=£215.00').first().isVisible(), 'the stale cache shows the old price rather than an empty one')
  ok(await T('serving a cached copy').isVisible(), 'and the band says so')
  await page.locator('#since').fill('180')
  ok(await page.locator('text=£189.00').first().isVisible(), 'past the time to live the correct price is back')
  ok(await page.locator('text=£215.00').count() === 0, 'and the stale price is gone from the page')
  await page.getByRole('button', { name: 'Ash' }).click()
  ok(await page.locator('main s, main .line-through').first().isVisible(), 'the Ash variant shows a struck through compare at price')
  await page.getByRole('button', { name: 'Chalk' }).click()
  await sw('WordPress serving a cached copy').click()

  // all five at once: a page that still looks finished
  await page.getByRole('button', { name: 'All five' }).click()
  await page.locator('#since').fill('5')
  ok(await T('5 of 8 fields empty').isVisible(), '5 of 8 fields empty with every fault on')
  ok(await page.locator('text=200 OK').first().isVisible(), 'and the response is still 200')
  ok(await page.locator('h2', { hasText: 'Kiln Stoneware Dinner Set' }).isVisible(), 'the product still has its title')
  ok(await page.locator('main img').count() === 4, 'and all its photographs, which is how these arrive for rescue')

  // the fix path
  await page.locator('text=specs.table returned null').first().click().catch(() => {})
  const read = page.getByRole('button', { name: 'Read the cause and the fix' }).first()
  await read.click()
  const fixBtn = page.locator('#fault-metafield-access').getByRole('button', { name: 'Apply the fix' })
  ok(await fixBtn.isVisible(), 'the cause panel opens with a fix that can be applied')
  ok(await page.locator('#fault-metafield-access').locator('text=access.storefront').first().isVisible(), 'and the mutation is on screen')
  await fixBtn.click()
  ok(await page.locator('table tbody tr').count() === 9, 'applying the fix brings the specifications back')

  // images really decoded
  const shots = await page.locator('main img').evaluateAll(els => els.map(e => [e.naturalWidth, e.complete]))
  ok(shots.length > 0 && shots.every(([w, c]) => c && w > 0), `${shots.length} photographs decoded, not just laid out`)

  // accessible names
  const nameless = await page.locator('button, [role=switch], a, input').evaluateAll(els =>
    els.filter(e => {
      const alts = [...e.querySelectorAll('img[alt]')].map(i => i.alt).join(' ')
      const n = (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.innerText || alts || e.title || '').trim()
      const lab = e.id ? document.querySelector(`label[for="${e.id}"]`) : null
      return !n && !lab && !e.closest('[aria-hidden=true]')
    }).map(e => e.outerHTML.slice(0, 70)),
  )
  ok(nameless.length === 0, `every control has an accessible name${nameless.length ? ': ' + nameless.join(' | ') : ''}`)

  // no horizontal scroll, and nothing poking out of the viewport
  await page.goto(BASE, { waitUntil: 'load' })
  const over = await page.evaluate(w => ({
    doc: document.documentElement.scrollWidth,
    wide: [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > w + 1 && getComputedStyle(e).overflowX !== 'auto').length,
  }), width)
  ok(over.doc <= width, `no horizontal scroll (${over.doc} <= ${width})`)
  ok(over.wide === 0, `${over.wide} elements overflow the viewport`)

  // tap targets, on a fresh load so focus is not left mid page
  const small = await page.locator('button[type=button], [role=switch]').evaluateAll(els =>
    els.filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 36 }).map(e => e.innerText.slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().height)),
  )
  ok(small.length === 0, `every tap target is at least 36px tall${small.length ? ': ' + small.join(', ') : ''}`)

  // measured contrast on every surface, including with faults on
  for (const state of ['default', 'all five']) {
    if (state === 'all five') {
      await page.getByRole('button', { name: 'All five' }).click()
      for (const f of ['metafield-access', 'stale-cache']) await page.locator(`#fault-${f} h3 button`).click()
    }
    const fails = await page.evaluate(CONTRAST)
    ok(fails.length === 0, `contrast, ${state}: ${fails.length ? JSON.stringify(fails.slice(0, 3)) : 'every text pair meets AA against its painted background'}`)
  }

  // the dashes rule, checked on what is painted
  const dashes = await page.evaluate(() => (document.body.innerText.match(/[–—]/g) || []).length)
  ok(dashes === 0, 'no em or en dashes in the rendered page')

  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`)
  await page.close()
}

await browser.close()
console.log(bad ? `\n${bad} FAILURES` : '\nSWEEP PASS')
process.exit(bad ? 1 : 0)
