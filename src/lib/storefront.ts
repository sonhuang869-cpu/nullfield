/**
 * A stand-in for the Shopify Storefront API, built to behave the way the real
 * one does when it is misconfigured: it succeeds.
 *
 * That is the whole point. Every fault here returns HTTP 200 with a well formed
 * response body. The missing data arrives as null, not as an error, which is
 * why a half-configured integration passes every smoke test anyone runs.
 */

import type { FaultId } from './faults'

export type Money = { amount: string; currencyCode: 'GBP' }

export type Variant = {
  id: string
  title: string
  sku: string
  availableForSale: boolean
  quantityAvailable: number
  price: Money
  compareAtPrice: Money | null
}

export type Image = { url: string; altText: string; width: number; height: number }

/** A metaobject entry, as the Storefront API returns one. */
export type MetaobjectField = { key: string; value: string }
export type Metaobject = { id: string; type: string; handle: string; fields: MetaobjectField[] } | null

export type Metafield = { namespace: string; key: string; type: string; value: string } | null

export type ProductResponse = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  vendor: string
  productType: string
  images: Image[]
  variants: Variant[]
  /** Flat custom fields. Null when the definition is not exposed. */
  specs: Metafield
  features: Metafield
  /** A reference to structured content. Null for several different reasons. */
  careGuide: Metaobject
  materials: Metaobject
}

/** The source of truth, as it exists in Shopify admin. */
const TRUTH = {
  id: 'gid://shopify/Product/8812001',
  handle: 'kiln-stoneware-dinner-set',
  title: 'Kiln Stoneware Dinner Set, Twelve Piece',
  vendor: 'Oreland',
  productType: 'Tableware',
  descriptionHtml:
    '<p>Thrown and glazed in Stoke-on-Trent, fired twice, and heavy enough that it does not slide when you cut on it. Twelve pieces: four dinner plates, four side plates, four bowls.</p>',
  images: [
    { url: '/img/set', altText: 'A cream stoneware dinner plate on white linen, with two serving spoons laid above it', width: 1200, height: 1500 },
    { url: '/img/bowl', altText: 'Plates, saucers and bowls arranged from above, showing the range of pieces in the set', width: 1200, height: 1500 },
    { url: '/img/stack', altText: 'Two stacks of plates on a dark wooden shelf, seen edge on in low light', width: 1200, height: 1500 },
  ] as Image[],
  variants: [
    { id: 'gid://shopify/ProductVariant/1', title: 'Chalk', sku: 'ORE-DS12-CHK', availableForSale: true, quantityAvailable: 34, price: { amount: '189.00', currencyCode: 'GBP' as const }, compareAtPrice: null },
    { id: 'gid://shopify/ProductVariant/2', title: 'Ash', sku: 'ORE-DS12-ASH', availableForSale: true, quantityAvailable: 6, price: { amount: '189.00', currencyCode: 'GBP' as const }, compareAtPrice: { amount: '215.00', currencyCode: 'GBP' as const } },
    { id: 'gid://shopify/ProductVariant/3', title: 'Peat', sku: 'ORE-DS12-PEA', availableForSale: false, quantityAvailable: 0, price: { amount: '189.00', currencyCode: 'GBP' as const }, compareAtPrice: null },
  ] as Variant[],
  specs: {
    namespace: 'specs', key: 'table', type: 'json',
    value: JSON.stringify([
      ['Pieces', '12'],
      ['Dinner plate', '27 cm'],
      ['Side plate', '21 cm'],
      ['Bowl', '18 cm, 600 ml'],
      ['Material', 'Stoneware, reactive glaze'],
      ['Firing', 'Twice, to 1240 C'],
      ['Dishwasher', 'Yes'],
      ['Microwave', 'Yes'],
      ['Made in', 'Stoke-on-Trent'],
    ]),
  } as Metafield,
  features: {
    namespace: 'specs', key: 'features', type: 'list.single_line_text_field',
    value: JSON.stringify([
      'Reactive glaze, so no two pieces are identical',
      'Unglazed foot ring, which stops the stacking marks',
      'Replacements sold singly, for as long as the line runs',
      'Oven safe to 220 C',
    ]),
  } as Metafield,
  careGuide: {
    id: 'gid://shopify/Metaobject/5501', type: 'care_guide', handle: 'stoneware-care',
    fields: [
      { key: 'title', value: 'Looking after reactive glaze' },
      { key: 'body', value: 'Dishwasher safe, but the reactive glaze keeps its depth longer if you wash the darker colours by hand. Avoid stacking straight out of a hot oven: the thermal shock is what crazes a glaze, not the dishwasher.' },
      { key: 'warning', value: 'Not suitable for direct flame or grill.' },
    ],
  } as Metaobject,
  materials: {
    id: 'gid://shopify/Metaobject/5502', type: 'material', handle: 'stoneware',
    fields: [
      { key: 'name', value: 'Stoneware' },
      { key: 'origin', value: 'Etruria marl, Staffordshire' },
      { key: 'body', value: 'Fired to 1240 C, which vitrifies the body and makes it non porous without a sealing glaze on the foot.' },
    ],
  } as Metaobject,
}

export type Query = {
  faults: Set<FaultId>
  /** How long ago the price was changed in Shopify, in minutes. */
  minutesSinceEdit: number
  /** The cache time to live the integration was built with. */
  cacheTtlMinutes: number
}

export type Trace = {
  field: string
  status: 'ok' | 'null'
  note: string
  fault?: FaultId
}

/**
 * Returns the response and a trace of every field that came back empty and why.
 * The trace is the thing a rescue job actually needs: it turns "the specs are
 * missing" into "this definition is not exposed".
 */
export function fetchProduct(q: Query): { data: ProductResponse; trace: Trace[]; httpStatus: number; cached: boolean } {
  const trace: Trace[] = []
  const has = (f: FaultId) => q.faults.has(f)

  const specs = has('metafield-access') ? null : TRUTH.specs
  const features = has('metafield-access') ? null : TRUTH.features

  // A missing token scope kills every metaobject. A definition that is not
  // exposed kills the ones under it. A draft entry kills exactly one.
  const careBlocked = has('token-scope') || has('metaobject-access') || has('metaobject-draft')
  const materialsBlocked = has('token-scope') || has('metaobject-access')

  trace.push(
    { field: 'product.title', status: 'ok', note: 'Core product fields are readable with the standard product scopes.' },
    { field: 'product.images', status: 'ok', note: `${TRUTH.images.length} images returned.` },
    { field: 'product.variants', status: 'ok', note: `${TRUTH.variants.length} variants, with price and availability.` },
    specs
      ? { field: 'metafield specs.table', status: 'ok', note: 'Definition exposed with access.storefront PUBLIC_READ.' }
      : { field: 'metafield specs.table', status: 'null', note: 'Returned empty. The definition is not exposed to the Storefront API.', fault: 'metafield-access' },
    features
      ? { field: 'metafield specs.features', status: 'ok', note: 'Definition exposed.' }
      : { field: 'metafield specs.features', status: 'null', note: 'Returned empty, same definition namespace as the table.', fault: 'metafield-access' },
    careBlocked
      ? {
          field: 'metaobject care_guide',
          status: 'null',
          note: has('token-scope')
            ? 'Returned empty. The token has no unauthenticated_read_metaobjects scope, so every metaobject is unreadable.'
            : has('metaobject-access')
              ? 'Returned empty. The metaobject definition is not exposed to the storefront.'
              : 'Returned empty. This entry is in DRAFT, so it is not served, while other entries of the same type are fine.',
          fault: has('token-scope') ? 'token-scope' : has('metaobject-access') ? 'metaobject-access' : 'metaobject-draft',
        }
      : { field: 'metaobject care_guide', status: 'ok', note: 'Definition exposed, entry ACTIVE, token scoped.' },
    materialsBlocked
      ? {
          field: 'metaobject material',
          status: 'null',
          note: has('token-scope')
            ? 'Returned empty, for the same token scope reason.'
            : 'Returned empty. Definition not exposed.',
          fault: has('token-scope') ? 'token-scope' : 'metaobject-access',
        }
      : { field: 'metaobject material', status: 'ok', note: 'Definition exposed, entry ACTIVE.' },
  )

  const cached = has('stale-cache') && q.minutesSinceEdit < q.cacheTtlMinutes
  if (has('stale-cache')) {
    trace.push(cached
      ? { field: 'cache', status: 'null', note: `Serving a copy cached ${q.minutesSinceEdit} minutes ago. The edit in Shopify will not appear for another ${q.cacheTtlMinutes - q.minutesSinceEdit} minutes.`, fault: 'stale-cache' }
      : { field: 'cache', status: 'ok', note: `The cache expired ${q.minutesSinceEdit - q.cacheTtlMinutes} minutes ago, so the page is current again. This is why the bug is never reproduced.` })
  }

  const data: ProductResponse = {
    id: TRUTH.id,
    handle: TRUTH.handle,
    title: TRUTH.title,
    descriptionHtml: TRUTH.descriptionHtml,
    vendor: TRUTH.vendor,
    productType: TRUTH.productType,
    images: TRUTH.images,
    // A stale cache shows the old price, which is the only fault that shows
    // wrong data rather than no data.
    variants: cached
      ? TRUTH.variants.map(v => ({ ...v, price: { ...v.price, amount: '215.00' } }))
      : TRUTH.variants,
    specs,
    features,
    careGuide: careBlocked ? null : TRUTH.careGuide,
    materials: materialsBlocked ? null : TRUTH.materials,
  }

  // The request always succeeds. That is the point.
  return { data, trace, httpStatus: 200, cached }
}

export const parseSpecs = (m: Metafield): [string, string][] => {
  if (!m) return []
  try { return JSON.parse(m.value) } catch { return [] }
}
export const parseList = (m: Metafield): string[] => {
  if (!m) return []
  try { return JSON.parse(m.value) } catch { return [] }
}
export const field = (mo: Metaobject, key: string) => mo?.fields.find(f => f.key === key)?.value ?? null
