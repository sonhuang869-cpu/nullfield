import { AlertTriangle, ArrowRight, Check, ChevronDown, Clock, Copy, Minus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { FAULTS, faultById, type FaultId } from './lib/faults'
import { fetchProduct, field, parseList, parseSpecs, type Trace } from './lib/storefront'
import { gbp, img, pence } from './lib/ui'

/* ---------------------------------------------------------------- bits ---- */

function Switch({ on, toggle, name, describedBy }: { on: boolean; toggle: () => void; name: string; describedBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-describedby={describedBy}
      onClick={toggle}
      className="flex w-full items-start gap-3 py-1.5 text-left"
    >
      <span
        aria-hidden="true"
        className={`flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 ${
          on ? 'border-neg bg-neg' : 'border-line bg-paper'
        }`}
      >
        <span className={`h-4 w-4 rounded-full bg-card shadow-sm ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
      <span className={`text-sm font-medium ${on ? 'text-neg' : 'text-ink'}`}>{name}</span>
    </button>
  )
}

function Empty({ label, fault, onWhy }: { label: string; fault: FaultId; onWhy: (id: FaultId) => void }) {
  const f = faultById(fault)
  return (
    <div className="fieldblock rounded-lg border border-dashed border-neg/55 bg-neg-soft p-4">
      <p className="flex items-center gap-2 font-mono text-xs text-neg">
        <Minus aria-hidden="true" className="h-3.5 w-3.5" />
        {label} returned null
      </p>
      <p className="mt-2 text-sm text-ink2">{f.name}.</p>
      <button
        type="button"
        onClick={() => onWhy(fault)}
        className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-clay underline decoration-clay/40 underline-offset-2 hover:decoration-clay"
      >
        Read the cause and the fix
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="on-panel relative mt-3 overflow-hidden rounded-lg bg-panel">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code).catch(() => {})
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        }}
        className="absolute top-2 right-2 inline-flex h-9 items-center gap-1.5 rounded-md border border-panel-line bg-panel2 px-2.5 text-xs text-on-panel-2 hover:text-on-panel"
      >
        {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 font-mono text-[12.5px] leading-relaxed text-on-panel-2">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/* ------------------------------------------------------------------ app ---- */

export default function App() {
  const [faults, setFaults] = useState<Set<FaultId>>(new Set(['metafield-access']))
  const [minutesSinceEdit, setMinutes] = useState(5)
  const [cacheTtlMinutes, setTtl] = useState(60)
  const [open, setOpen] = useState<FaultId | null>(null)
  const [shot, setShot] = useState(0)
  const [variant, setVariant] = useState(0)
  const detail = useRef<HTMLDivElement>(null)

  const toggle = (id: FaultId) =>
    setFaults(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const why = (id: FaultId) => {
    setOpen(id)
    document.getElementById(`fault-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const { data, trace, httpStatus, cached } = useMemo(
    () => fetchProduct({ faults, minutesSinceEdit, cacheTtlMinutes }),
    [faults, minutesSinceEdit, cacheTtlMinutes],
  )

  const empties = trace.filter(t => t.status === 'null').length
  const specs = parseSpecs(data.specs)
  const features = parseList(data.features)
  const v = data.variants[Math.min(variant, data.variants.length - 1)]
  const image = data.images[shot]

  return (
    <div className="min-h-dvh bg-paper">
      {/* The band that never changes colour, because the request never fails. */}
      <div className="on-panel sticky top-0 z-30 bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 font-mono text-xs sm:px-6">
          <span className="inline-flex items-center gap-1.5 text-panel-pos">
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
            {httpStatus} OK
          </span>
          <span className="text-on-panel-muted">no errors array</span>
          <span className={empties ? 'text-panel-neg' : 'text-on-panel-2'}>
            {empties} of {trace.length} fields empty
          </span>
          {cached && <span className="text-panel-warn">serving a cached copy</span>}
        </div>
      </div>

      <header className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="font-mono text-xs tracking-[0.18em] text-clay uppercase">Nullfield</p>
          <h1 className="mt-3 max-w-3xl text-3xl leading-[1.1] font-semibold text-ink sm:text-4xl">
            The request succeeded. The specifications are gone.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink2 sm:text-base">
            A working reproduction of a Shopify catalogue feeding a WordPress brand site, with the five faults that
            leave the custom fields blank. Flip a switch and the product page below empties out. The status code stays
            200, the response stays well formed, and nothing is logged. That is the reason a build like this gets
            handed over as nearly finished.
          </p>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            Every cause and fix here is quoted from Shopify&rsquo;s own documentation, checked this week. Oreland is a
            stand-in brand so the data can be shown in full.
          </p>
        </div>
      </header>

      {/* --------------------------------------------------------- switches -- */}
      <section aria-labelledby="sw" className="border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="sw" className="text-lg font-semibold text-ink">
              Turn on what their build has
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFaults(new Set(FAULTS.map(f => f.id)))}
                className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink2 hover:border-clay hover:text-clay"
              >
                All five
              </button>
              <button
                type="button"
                onClick={() => setFaults(new Set())}
                className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink2 hover:border-clay hover:text-clay"
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {FAULTS.map(f => (
              <li key={f.id}>
                <Switch on={faults.has(f.id)} toggle={() => toggle(f.id)} name={f.name} describedBy={`d-${f.id}`} />
                <p id={`d-${f.id}`} className="mt-1.5 pl-14 text-sm leading-relaxed text-muted">
                  {f.symptom}
                </p>
              </li>
            ))}
          </ul>

          {faults.has('stale-cache') && (
            <div className="mt-6 rounded-lg border border-warn/40 bg-warn-soft p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-warn">
                <Clock aria-hidden="true" className="h-4 w-4" />
                The cache fault depends entirely on when you look
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="since" className="block text-sm text-ink2">
                    Price changed in Shopify <strong className="font-semibold text-ink">{minutesSinceEdit} min</strong>{' '}
                    ago
                  </label>
                  <input
                    id="since"
                    type="range"
                    min={0}
                    max={180}
                    step={5}
                    value={minutesSinceEdit}
                    onChange={e => setMinutes(Number(e.target.value))}
                    className="mt-2 w-full accent-[#86560a]"
                  />
                </div>
                <div>
                  <label htmlFor="ttl" className="block text-sm text-ink2">
                    Cache built with a <strong className="font-semibold text-ink">{cacheTtlMinutes} min</strong> time to
                    live
                  </label>
                  <input
                    id="ttl"
                    type="range"
                    min={0}
                    max={180}
                    step={5}
                    value={cacheTtlMinutes}
                    onChange={e => setTtl(Number(e.target.value))}
                    className="mt-2 w-full accent-[#86560a]"
                  />
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink2">
                {cached
                  ? `The page is ${cacheTtlMinutes - minutesSinceEdit} minutes away from telling the truth.`
                  : 'Past the time to live, so the page is correct again. Drag the first slider down and the bug comes back.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ page and console -- */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:gap-8">
        {/* the brand site */}
        <main className="lg:col-span-7">
          <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">
            oreland.co.uk <span className="text-clay">/ WordPress</span>
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-card">
            <img
              {...img(image.url)}
              alt={image.altText}
              width={image.width}
              height={image.height}
              className="aspect-4/5 w-full object-cover"
            />
            <div className="flex gap-2 border-t border-line p-2">
              {data.images.map((im, i) => (
                <button
                  key={im.url}
                  type="button"
                  onClick={() => setShot(i)}
                  aria-current={i === shot}
                  className={`overflow-hidden rounded-md border-2 ${i === shot ? 'border-clay' : 'border-transparent'}`}
                >
                  <img
                    src={`${im.url}-400.webp`}
                    alt={`View ${i + 1}: ${im.altText}`}
                    width={400}
                    height={500}
                    className="aspect-4/5 w-16 object-cover sm:w-20"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">
              {data.vendor} / {data.productType}
            </p>
            <h2 className="mt-2 text-2xl leading-tight font-semibold text-ink">{data.title}</h2>

            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <p className="text-2xl font-semibold text-ink">{gbp(v.price)}</p>
              {v.compareAtPrice && pence(v.compareAtPrice) > pence(v.price) && (
                <p className="text-base text-muted line-through">{gbp(v.compareAtPrice)}</p>
              )}
              {cached && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  cached {minutesSinceEdit} min ago
                </span>
              )}
            </div>

            <div
              className="prose-sm mt-4 text-[15px] leading-relaxed text-ink2"
              // The description is a core product field, so it is never the
              // thing that goes missing. It is here to show the page looks fine.
              dangerouslySetInnerHTML={{ __html: data.descriptionHtml }}
            />

            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-ink">Glaze</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.variants.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setVariant(i)}
                    disabled={!o.availableForSale}
                    aria-pressed={i === variant}
                    className={`rounded-md border px-3.5 py-2 text-sm ${
                      i === variant ? 'border-clay bg-clay-soft font-medium text-clay' : 'border-line text-ink2'
                    } ${o.availableForSale ? 'hover:border-clay' : 'cursor-not-allowed text-muted line-through'}`}
                  >
                    {o.title}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="mt-3 text-sm text-muted">
              {v.availableForSale ? `${v.quantityAvailable} in stock, dispatched next working day` : 'Out of stock'}
              <span className="ml-2 font-mono text-xs">{v.sku}</span>
            </p>

            <button
              type="button"
              disabled={!v.availableForSale}
              className="mt-5 w-full rounded-lg bg-clay px-5 py-3.5 font-medium text-card disabled:bg-line disabled:text-muted"
            >
              {v.availableForSale ? 'Add to basket' : 'Out of stock'}
            </button>
          </div>

          {/* the four blocks that go quiet */}
          <section className="mt-10 border-t border-line pt-8">
            <h3 className="text-base font-semibold text-ink">Specification</h3>
            <div className="mt-3">
              {specs.length ? (
                <table className="w-full text-sm">
                  <tbody>
                    {specs.map(([k, val]) => (
                      <tr key={k} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2.5 pr-4 text-left font-normal text-muted">
                          {k}
                        </th>
                        <td className="py-2.5 text-right font-medium text-ink">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty label="specs.table" fault="metafield-access" onWhy={why} />
              )}
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-base font-semibold text-ink">Why this set</h3>
            <div className="mt-3">
              {features.length ? (
                <ul className="space-y-2.5">
                  {features.map(t => (
                    <li key={t} className="flex gap-2.5 text-sm text-ink2">
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-pos" />
                      {t}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty label="specs.features" fault="metafield-access" onWhy={why} />
              )}
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-base font-semibold text-ink">Care</h3>
            <div className="mt-3">
              {data.careGuide ? (
                <div className="rounded-lg border border-line bg-card p-5">
                  <p className="font-medium text-ink">{field(data.careGuide, 'title')}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink2">{field(data.careGuide, 'body')}</p>
                  <p className="mt-3 flex items-start gap-2 text-sm text-warn">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    {field(data.careGuide, 'warning')}
                  </p>
                </div>
              ) : (
                <Empty
                  label="metaobject care_guide"
                  fault={
                    faults.has('token-scope')
                      ? 'token-scope'
                      : faults.has('metaobject-access')
                        ? 'metaobject-access'
                        : 'metaobject-draft'
                  }
                  onWhy={why}
                />
              )}
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-base font-semibold text-ink">Material</h3>
            <div className="mt-3">
              {data.materials ? (
                <div className="rounded-lg border border-line bg-card p-5">
                  <p className="font-medium text-ink">{field(data.materials, 'name')}</p>
                  <p className="font-mono text-xs text-muted">{field(data.materials, 'origin')}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink2">{field(data.materials, 'body')}</p>
                </div>
              ) : (
                <Empty
                  label="metaobject material"
                  fault={faults.has('token-scope') ? 'token-scope' : 'metaobject-access'}
                  onWhy={why}
                />
              )}
            </div>
          </section>
        </main>

        {/* the console */}
        <aside className="lg:col-span-5">
          <div className="on-panel lg:sticky lg:top-14 overflow-hidden rounded-xl bg-panel">
            <div className="border-b border-panel-line px-5 py-4">
              <p className="font-mono text-xs text-on-panel-muted">
                POST /api/2026-07/graphql.json
              </p>
              <p className="mt-2 flex items-center gap-2 font-mono text-sm text-panel-pos">
                <Check aria-hidden="true" className="h-4 w-4" />
                HTTP {httpStatus}, body well formed, no errors array
              </p>
              <p className="mt-2 text-sm leading-relaxed text-on-panel-2">
                {empties === 0
                  ? 'Every field requested came back with a value. This is what the handover is supposed to look like.'
                  : `${empties} of the ${trace.length} fields requested came back empty. Nothing in the response says so.`}
              </p>
            </div>

            <ul className="divide-y divide-panel-line">
              {trace.map((t: Trace) => (
                <li key={t.field} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-[12.5px] text-on-panel">{t.field}</p>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] ${
                        t.status === 'ok' ? 'bg-panel2 text-panel-pos' : 'bg-panel2 text-panel-neg'
                      }`}
                    >
                      {t.status === 'ok' ? 'value' : 'null'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-on-panel-2">{t.note}</p>
                  {t.fault && (
                    <button
                      type="button"
                      onClick={() => why(t.fault!)}
                      className="mt-1 inline-flex min-h-9 items-center gap-1 text-[13px] font-medium text-panel-clay underline decoration-panel-clay/40 underline-offset-2 hover:decoration-panel-clay"
                    >
                      {faultById(t.fault).name}
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="border-t border-panel-line bg-panel2 px-5 py-4">
              <p className="text-[13px] leading-relaxed text-on-panel-2">
                Inside Shopify admin all four custom fields are filled in: nine specification rows, four features, a
                care guide and a material. An editor checking their own work in admin sees the data every time.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ----------------------------------------------------- the details -- */}
      <section aria-labelledby="det" className="border-t border-line bg-card" ref={detail}>
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <h2 id="det" className="text-xl font-semibold text-ink sm:text-2xl">
            What each one actually is
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink2">
            Cause, the reason it survives testing, and the exact call that fixes it.
          </p>

          <div className="mt-8 space-y-4">
            {FAULTS.map(f => {
              const isOpen = open === f.id
              return (
                <div
                  key={f.id}
                  id={`fault-${f.id}`}
                  className={`scroll-mt-20 overflow-hidden rounded-xl border ${
                    faults.has(f.id) ? 'border-neg/40 bg-neg-soft' : 'border-line bg-paper'
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : f.id)}
                      aria-expanded={isOpen}
                      aria-controls={`body-${f.id}`}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left"
                    >
                      <span
                        className={`font-mono text-[11px] ${faults.has(f.id) ? 'text-neg' : 'text-muted'}`}
                        aria-hidden="true"
                      >
                        {faults.has(f.id) ? 'ON' : 'off'}
                      </span>
                      <span className="flex-1 font-medium text-ink">{f.name}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-muted ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h3>
                  {isOpen && (
                    <div id={`body-${f.id}`} className="border-t border-line px-5 pt-4 pb-5">
                      <dl className="space-y-4 text-[15px] leading-relaxed">
                        <div>
                          <dt className="font-mono text-xs tracking-wider text-muted uppercase">Cause</dt>
                          <dd className="mt-1 text-ink2">{f.cause}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-xs tracking-wider text-muted uppercase">
                            Why testing misses it
                          </dt>
                          <dd className="mt-1 text-ink2">{f.whyMissed}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-xs tracking-wider text-muted uppercase">Fix</dt>
                          <dd className="mt-1 text-ink2">{f.fix}</dd>
                        </div>
                      </dl>
                      <Snippet code={f.snippet} />
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted">Checked against {f.source}.</p>
                        {faults.has(f.id) && (
                          <button
                            type="button"
                            onClick={() => toggle(f.id)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-pos px-3 text-sm font-medium text-card"
                          >
                            <Check aria-hidden="true" className="h-4 w-4" />
                            Apply the fix
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- the offer -- */}
      <section aria-labelledby="res" className="border-t border-line">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <h2 id="res" className="text-xl font-semibold text-ink sm:text-2xl">
            How a takeover like this starts
          </h2>
          <ol className="mt-6 space-y-6">
            {[
              [
                'Audit what is already there',
                'The previous build is not thrown away. Read it, list every custom field the brand page needs, and mark which ones are flowing, which are empty and which are wrong. That list is the first deliverable, and it is usually shorter than anyone fears.',
              ],
              [
                'Fix at the definition, not the template',
                'Three of the five faults above are one Admin API mutation each, on the Shopify side. Patching the WordPress template to hide an empty section is how a build ends up unmaintainable, because the next person cannot tell the difference between a field with no data and a field with no access.',
              ],
              [
                'Make changes flow on their own',
                'Shopify stays the single source for products and prices, and a products/update webhook invalidates the WordPress cache instead of a timer. Then an edit in Shopify shows on the brand site in seconds, which is what the brief asks for.',
              ],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-soft font-mono text-sm font-medium text-clay">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-medium text-ink">{t}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink2">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm leading-relaxed text-muted sm:px-6">
          <p className="text-ink2">
            Built by Muhammad Razeen Shahid as a working reproduction, not a slide. The faults, the traces and the
            fixes all run in the browser.
          </p>
          <p className="mt-3">
            Oreland is a stand-in brand. Photographs are from Unsplash under its licence. Every cause and fix was
            checked against shopify.dev in October 2026: metafield and metaobject storefront access, the publishable
            capability, the unauthenticated_read_metaobjects scope, and the products/update webhook topic.
          </p>
        </div>
      </footer>
    </div>
  )
}
