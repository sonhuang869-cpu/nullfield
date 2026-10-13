/**
 * The four ways a Shopify to WordPress integration half works.
 *
 * Every one of these is silent. The GraphQL request succeeds, the HTTP status
 * is 200, the page renders, and the custom fields are simply empty. That is why
 * these projects get handed over as "nearly finished": the parts that fail are
 * the parts nobody notices until a client asks where the specifications went.
 *
 * Each fix below is quoted from Shopify's own documentation, checked on
 * 13 October 2026. The sources are listed in the README.
 */

export type FaultId =
  | 'metafield-access'
  | 'metaobject-access'
  | 'metaobject-draft'
  | 'token-scope'
  | 'stale-cache'

export type Fault = {
  id: FaultId
  name: string
  /** What the person looking at the website sees. */
  symptom: string
  /** What is actually happening at the API. */
  cause: string
  /** Why it survives testing, which is the reason the project is in trouble. */
  whyMissed: string
  fix: string
  /** The exact call, so it is checkable rather than hand-waved. */
  snippet: string
  /** Verified against Shopify documentation rather than recalled. */
  source: string
}

export const FAULTS: Fault[] = [
  {
    id: 'metafield-access',
    name: 'Metafield not exposed to the Storefront API',
    symptom: 'Specifications, features and any other custom field render empty on WordPress, while they are plainly filled in inside Shopify admin.',
    cause: 'A metafield definition carries an access setting, and storefront access defaults to NONE. The field is readable by the Admin API and invisible to the Storefront API until that is changed.',
    whyMissed: 'The query does not fail. The field comes back with no value, so the request is a 200, the template renders, and the section is just blank. Anyone testing in the Shopify admin sees the data and assumes it is flowing.',
    fix: 'Set access.storefront to PUBLIC_READ on the definition, with metafieldDefinitionCreate or metafieldDefinitionUpdate in the Admin API.',
    snippet: `mutation {
  metafieldDefinitionUpdate(definition: {
    namespace: "specs"
    key: "wattage"
    ownerType: PRODUCT
    access: { storefront: PUBLIC_READ }
  }) {
    updatedDefinition { id }
    userErrors { field message }
  }
}`,
    source: 'shopify.dev, Retrieve metafields with the Storefront API',
  },
  {
    id: 'metaobject-access',
    name: 'Metaobject definition not readable by the storefront',
    symptom: 'Linked content such as a materials guide, a care sheet or a set of related specifications returns nothing, while single metafields on the same product work.',
    cause: 'A metaobject definition has its own storefront access setting, separate from the metafields that reference it. Exposing the referencing metafield does not expose what it points at.',
    whyMissed: 'It looks like a partial success, which is the most misleading outcome of all. Some custom fields appear and some do not, so the integration gets blamed on the WordPress side.',
    fix: 'Set access.storefront to PUBLIC_READ on the metaobject definition as well as on the metafield that references it.',
    snippet: `mutation {
  metaobjectDefinitionUpdate(id: "gid://shopify/MetaobjectDefinition/123", definition: {
    access: { storefront: PUBLIC_READ }
  }) {
    metaobjectDefinition { type }
    userErrors { field message }
  }
}`,
    source: 'shopify.dev, metaobject capabilities and access',
  },
  {
    id: 'metaobject-draft',
    name: 'Metaobject entry left in draft',
    symptom: 'One product is missing its linked content while every other product is fine.',
    cause: 'Where a metaobject definition has the publishable capability, each entry is DRAFT or ACTIVE, and a draft entry is not served to the storefront.',
    whyMissed: 'This is the one that gets called intermittent. It is per entry, not per definition, so it appears and disappears as content is added, and it usually lands on whichever product was set up last.',
    fix: 'Publish the entry, or drop the publishable capability if every entry should always be live.',
    snippet: `mutation {
  metaobjectUpdate(id: "gid://shopify/Metaobject/456", metaobject: {
    capabilities: { publishable: { status: ACTIVE } }
  }) {
    metaobject { handle }
    userErrors { field message }
  }
}`,
    source: 'shopify.dev, use metaobject capabilities',
  },
  {
    id: 'token-scope',
    name: 'Storefront token missing the metaobject scope',
    symptom: 'Every metaobject read fails at once, across all products, usually right after the token was rotated.',
    cause: 'Reading metaobjects through the Storefront API needs the unauthenticated_read_metaobjects scope on the token. A token issued for products alone will read products perfectly and nothing else.',
    whyMissed: 'The product fields keep working, so the integration looks alive. Only the linked content dies, which is the part nobody has a test for.',
    fix: 'Reissue the Storefront access token with unauthenticated_read_metaobjects alongside the product scopes.',
    snippet: `// Storefront access token scopes
unauthenticated_read_product_listings
unauthenticated_read_product_inventory
unauthenticated_read_metaobjects   // the one usually missing`,
    source: 'shopify.dev, Storefront API metaobjects reference',
  },
  {
    id: 'stale-cache',
    name: 'WordPress serving a cached copy',
    symptom: 'A price or a description is changed in Shopify and the brand site still shows the old one, sometimes for hours.',
    cause: 'The integration caches the API response with a time to live and nothing invalidates it when Shopify changes. The brief asks for changes to flow through reliably, and a TTL is not reliability, it is a delay with a maximum.',
    whyMissed: 'It self heals. By the time anyone looks, the cache has expired and the data is right, so the bug is reported as "it was wrong earlier" and never reproduced.',
    fix: 'Keep the cache, but invalidate it from a Shopify webhook on products/update rather than waiting for a timer.',
    snippet: `add_action( 'rest_api_init', function () {
  register_rest_route( 'brand/v1', '/shopify-webhook', array(
    'methods'  => 'POST',
    'callback' => 'brand_flush_product_cache',
    // Verify the HMAC before trusting anything in the body.
    'permission_callback' => 'brand_verify_shopify_hmac',
  ) );
} );`,
    source: 'Shopify webhook topic products/update',
  },
]

export const faultById = (id: FaultId) => FAULTS.find(f => f.id === id)!
