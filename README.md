# Nullfield

A working reproduction of the five ways a Shopify catalogue feeding a WordPress
brand site goes quiet without ever failing.

Flip a switch and the product page empties out. The status code stays 200, the
response body stays well formed, there is no `errors` array and nothing is
logged. That is the whole point: the parts that break are the parts no smoke
test covers, which is why a build like this gets handed over as nearly
finished.

Live: https://nullfield.vercel.app

## The five faults

| Fault | What breaks | Where the fix goes |
| --- | --- | --- |
| Metafield not exposed to the Storefront API | Every flat custom field, while admin shows the data | `access.storefront: PUBLIC_READ` on the definition |
| Metaobject definition not readable by the storefront | Linked content only, so it looks like a partial success | `access.storefront: PUBLIC_READ` on the metaobject definition |
| Metaobject entry left in draft | One product, which is why it gets called intermittent | Publish the entry, or drop the publishable capability |
| Storefront token missing the metaobject scope | Every metaobject at once, usually after a token rotation | Reissue with `unauthenticated_read_metaobjects` |
| WordPress serving a cached copy | Shows the old price rather than no price | Invalidate from a `products/update` webhook, not a timer |

The last one is the only fault that shows wrong data rather than none, and the
only one that heals itself before anyone can reproduce it. The sliders in the
demo set how long ago the price changed in Shopify and what time to live the
cache was built with, which is the entire bug in two numbers.

## Checked, not recalled

Every cause and fix was verified against shopify.dev in October 2026:
metafield storefront access and its `NONE` default, metaobject definition
access, the publishable capability and `DRAFT` status, the
`unauthenticated_read_metaobjects` scope, and the `products/update` webhook
topic. `metafieldStorefrontVisibilityCreate` is not used anywhere here because
it was removed in API version 2025-01.

## Running it

```bash
npm install
npm run dev        # the demo
npx tsx check.ts   # the fault model, asserted
node sweep.mjs     # the built site, swept at 390px and 1280px
```

`check.ts` asserts that all five faults still return 200, that each one breaks
exactly what it should and nothing else, that the cache fault is the only one
showing wrong data, and that five faults at once still render a product page
that looks finished.

`sweep.mjs` drives the built site in a headless browser at both widths. The
contrast probe composites the real painted background rather than reading the
declared colour, so tinted panels and opacity variants are measured as they are
actually seen. Lowest text ratio on the page is 4.61:1 against WCAG 2.1 AA.

## Notes

Oreland is a stand-in brand so the data can be shown in full. Photographs are
from Unsplash under its licence, resized and converted locally, and the alt text
describes what is actually in each frame. Money is handled as integer pence and
only formatted at the edge.

Built by Muhammad Razeen Shahid.
