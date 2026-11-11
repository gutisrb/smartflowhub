/**
 * Every demo tenant is seeded with its own `demo_brand_color`, and until now the
 * onboarding ignored all of them and rendered emerald for everybody. A lead whose
 * brand is pink opening a green dashboard is being shown somebody else's product.
 *
 * The catch is that a brand colour chosen for white marketing material can be
 * illegible on a near-black UI — a deep navy accent disappears. So the colour is
 * accepted but floored: hue and saturation are kept, lightness is lifted only if
 * it would otherwise fail against #05080c.
 */

const FALLBACK = "#10b981"

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")

/** WCAG relative luminance */
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * A usable accent for the dark dashboard. Returns the tenant's own colour when it
 * carries enough light, a brightened version of it when it doesn't, and emerald
 * when the value is missing or malformed.
 */
export function brandAccent(input?: string | null): string {
  if (!input) return FALLBACK
  const rgb = hexToRgb(input)
  if (!rgb) return FALLBACK

  const MIN_LUM = 0.18 // below this an accent stops reading against #05080c
  let [r, g, b] = rgb
  let guard = 0
  while (luminance([r, g, b]) < MIN_LUM && guard++ < 24) {
    // move toward white in small steps: preserves hue, lifts value
    r += (255 - r) * 0.12
    g += (255 - g) * 0.12
    b += (255 - b) * 0.12
  }
  return toHex(r, g, b)
}
