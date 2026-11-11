// WCAG contrast of every text/background pair the Ponuda uses, computed from the real oklch tokens in app/globals.css.
// node scripts/check_ponuda_contrast.mjs        exit 1 if any reading pair is below 7:1 (body) / 4.5:1 (secondary, large text 3:1)
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(resolve(root, 'app/globals.css'), 'utf8')
const start = css.search(/\n\.dark\s*\{/)   // the real dark theme block, not the `@custom-variant dark` line
if (start < 0) throw new Error('.dark block not found in app/globals.css')
const dark = css.slice(start)
const tok = (name) => { const m = dark.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`)); if (!m) throw new Error('token ' + name); return m[1] }

function oklch([L, C, h]) { // → sRGB 0..1
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
  return lin.map((v) => Math.min(1, Math.max(0, v)))
}
const parse = (s) => { const [lch, alpha] = s.split('/'); const n = lch.trim().split(/\s+/).map(Number); return { rgb: oklch(n), a: alpha ? parseFloat(alpha) / 100 : 1 } }
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const over = (fg, bg) => fg.a >= 1 ? fg.rgb : fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a))

const surfaces = { 'surface-2 (panels)': parse(tok('surface-2')).rgb, 'surface-3 (nodes)': parse(tok('surface-3')).rgb, 'background (page)': parse(tok('background')).rgb }
const texts = { 'heading oklch(0.97 0 0)': ['0.97 0 0', 7], 'body oklch(0.88 0.005 240)': ['0.88 0.005 240', 7], 'soft oklch(0.74 0.01 240)': ['0.74 0.01 240', 4.5] }
let bad = 0
for (const [sn, bg] of Object.entries(surfaces)) for (const [tn, [v, min]] of Object.entries(texts)) {
  const r = ratio(parse(v).rgb, bg); const ok = r >= min; if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(1).padStart(5)}:1  (min ${min})  ${tn}  on  ${sn}`)
}
// button text on any tenant colour: the component picks white or near-black, whichever reads better
const hexes = { emerald: '#10b981', purple: '#8b5cf6', red: '#dc2626', yellow: '#f5c518', navy: '#1a2b4c', orange: '#f97316' }
const sr = (h) => [1, 3, 5].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
for (const [n, h] of Object.entries(hexes)) {
  const b = sr(h); const w = ratio([1, 1, 1], b), k = ratio(sr('#0b0d0c'), b); const best = Math.max(w, k); if (best < 4.5) bad++
  console.log(`${best >= 4.5 ? 'ok  ' : 'FAIL'} ${best.toFixed(1).padStart(5)}:1  button text on ${n} ${h} (${w >= k ? 'white' : 'dark'})`)
}
process.exit(bad ? 1 : 0)
