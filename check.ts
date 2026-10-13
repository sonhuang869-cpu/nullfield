import { FAULTS, faultById, type FaultId } from './src/lib/faults'
import { fetchProduct, parseSpecs, parseList, field, type Query } from './src/lib/storefront'

let bad = 0
const ok = (c: boolean, m: string) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++ }
const q = (faults: FaultId[], extra: Partial<Query> = {}): Query =>
  ({ faults: new Set(faults), minutesSinceEdit: 5, cacheTtlMinutes: 60, ...extra })

console.log('=== a healthy integration ===')
const good = fetchProduct(q([]))
ok(good.httpStatus === 200, 'returns 200')
ok(good.data.specs !== null && parseSpecs(good.data.specs).length === 9, `specifications arrive, ${parseSpecs(good.data.specs).length} rows`)
ok(parseList(good.data.features).length === 4, `${parseList(good.data.features).length} features arrive`)
ok(good.data.careGuide !== null && !!field(good.data.careGuide, 'body'), 'the care guide metaobject arrives with its body')
ok(good.data.materials !== null, 'the materials metaobject arrives')
ok(good.trace.every(t => t.status === 'ok'), 'and nothing in the trace is empty')

console.log('\n=== every fault still returns 200, which is why they are missed ===')
for (const f of FAULTS) {
  const r = fetchProduct(q([f.id]))
  ok(r.httpStatus === 200, `${f.id.padEnd(18)} still returns HTTP 200`)
}

console.log('\n=== each fault breaks exactly what it should, and nothing else ===')
const mf = fetchProduct(q(['metafield-access']))
ok(mf.data.specs === null && mf.data.features === null, 'metafield-access empties both metafields')
ok(mf.data.careGuide !== null && mf.data.materials !== null, 'and leaves the metaobjects working, which is what makes it confusing')
ok(mf.data.title.length > 0 && mf.data.variants.length === 3, 'core product fields are untouched')

const moa = fetchProduct(q(['metaobject-access']))
ok(moa.data.careGuide === null && moa.data.materials === null, 'metaobject-access empties every metaobject')
ok(moa.data.specs !== null, 'and leaves the flat metafields working, which is the partial success that gets blamed on WordPress')

const draft = fetchProduct(q(['metaobject-draft']))
ok(draft.data.careGuide === null, 'metaobject-draft empties the one draft entry')
ok(draft.data.materials !== null, 'and leaves every other entry of a different type alone, which is why it gets called intermittent')

const scope = fetchProduct(q(['token-scope']))
ok(scope.data.careGuide === null && scope.data.materials === null, 'a missing token scope empties every metaobject at once')
ok(scope.data.specs !== null && scope.data.variants.length === 3, 'while products keep working perfectly, so the integration looks alive')

console.log('\n=== the cache fault is the only one that shows wrong data rather than none ===')
const fresh = fetchProduct(q(['stale-cache'], { minutesSinceEdit: 5, cacheTtlMinutes: 60 }))
ok(fresh.cached, 'five minutes after an edit, with a sixty minute cache, the page is stale')
ok(fresh.data.variants[0].price.amount === '215.00', 'and it shows the old price rather than an empty one')
const expired = fetchProduct(q(['stale-cache'], { minutesSinceEdit: 90, cacheTtlMinutes: 60 }))
ok(!expired.cached, 'ninety minutes later the cache has expired')
ok(expired.data.variants[0].price.amount === '189.00', 'and the correct price is back, which is why nobody can reproduce it')

console.log('\n=== the trace names the fault, not just the symptom ===')
for (const f of FAULTS) {
  const r = fetchProduct(q([f.id], { minutesSinceEdit: 5, cacheTtlMinutes: 60 }))
  const hit = r.trace.find(t => t.fault === f.id)
  ok(!!hit, `${f.id.padEnd(18)} produces a trace entry naming it`)
  if (hit) ok(hit.note.length > 40, `  with an explanation: "${hit.note.slice(0, 56)}…"`)
}

console.log('\n=== every fault carries a fix that can be pasted ===')
for (const f of FAULTS) {
  ok(f.snippet.trim().length > 40, `${f.id.padEnd(18)} has a usable snippet`)
  ok(f.source.trim().length > 10, `  and names where it was checked: ${f.source}`)
  ok(f.whyMissed.trim().length > 40, '  and explains why it survives testing')
}

console.log('\n=== faults combine the way they would in a real broken build ===')
const all = fetchProduct(q(FAULTS.map(f => f.id)))
ok(all.httpStatus === 200, 'all five at once still returns 200')
ok(all.data.specs === null && all.data.careGuide === null && all.data.materials === null, 'with every custom field empty')
ok(all.data.title.length > 0 && all.data.images.length === 3, 'and the product still rendering, which is exactly how these arrive for rescue')
const named = new Set(all.trace.filter(t => t.fault).map(t => t.fault))
ok(named.size >= 3, `${named.size} distinct faults named in one trace`)

console.log('\n=== the catalogue itself ===')
ok(FAULTS.length === 5, `${FAULTS.length} faults documented`)
ok(new Set(FAULTS.map(f => f.id)).size === FAULTS.length, 'ids are unique')
ok(FAULTS.every(f => faultById(f.id).name === f.name), 'every id resolves')

console.log(bad ? `\n${bad} FAILURES` : '\nINTEGRATION FAULT CHECKS PASS')
process.exit(bad ? 1 : 0)
