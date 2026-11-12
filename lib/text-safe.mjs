// Text that goes into Postgres must not carry half an emoji: a cut at a UTF-16 boundary leaves a lone surrogate and the whole insert is
// rejected (2026-11-12: SLW Container's post caption was cut inside an emoji, the insert failed AFTER the wipe and the demo was empty).
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
export const stripLone = (s) => String(s ?? '').replace(LONE, '')
/** First n characters (code points, never half an emoji). */
export const cut = (s, n) => [...stripLone(s)].slice(0, n).join('')
/** Deep copy with every string scrubbed of lone surrogates. */
export const scrub = (v) => (typeof v === 'string' ? stripLone(v) : Array.isArray(v) ? v.map(scrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)])) : v)
