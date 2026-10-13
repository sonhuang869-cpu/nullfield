import type { Money } from './storefront'

/** Money is handled as integer pence and only formatted at the edge. */
export const pence = (m: Money) => Math.round(parseFloat(m.amount) * 100)

export const gbp = (m: Money) =>
  (pence(m) / 100).toLocaleString('en-GB', { style: 'currency', currency: m.currencyCode, minimumFractionDigits: 2 })

export const img = (base: string) => ({
  src: `${base}.webp`,
  srcSet: `${base}-400.webp 400w, ${base}.webp 1200w`,
  sizes: '(min-width: 1024px) 520px, 100vw',
})
