// How THIS business's customers start a conversation and what stops them — taken from the questions
// they really ask under its own Instagram posts (collect_customer_voice.mjs). Nothing here assumes
// how a business is reached: a clinic whose patients DM "Da li može na rate?" opens with a plain DM;
// a container maker whose customers comment "Poštovani, cena ovog kontejnera od 29m2???" under a post
// of that object opens as a reply to that post. No usable question → a plain DM about the main offer.
// (Nikola, 2026-10-27: "Demos are business specific. Don't make automated assumptions.")

const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')

// chatter, politics, tags of friends — real comments, but not a customer asking
const NOISE = /brat|vrh\b|glas(ac|aci|ajte)|lista\b|samoubistv|haha|😂|🤣|ako mozes u dm|imate poruku|poslal[ai] sam|odgovorite|\binbox\b|\bpp\b/i
const PRICE_Q = /cen[aeuo]\b|cijen|koliko|kost|kosta|kolko/
const INSTALMENTS = /(?<![a-z])(rat[aeu]|na rate|kredit|odlozen)/
const DELIVERY_Q = /prevoz|dostav|montaz|do mene|km od|u bosn|za opstin/
// Macedonian / regional forms a Serbian business's demo should not open with
const NOT_SERBIAN = /(?<![a-z])(kolku|gorna|dolna|so \d|e cena|koja e)(?![a-z])/
// vague: refers to the post without saying what is wanted
const VAGUE = /o cemu pricate|upravo to|ovo sto|sta je ovo/

/** A real comment, made readable without changing what the customer said. */
export function cleanQuestion(text) {
  let t = String(text || '').replace(/\s+/g, ' ').replace(/\*+/g, '').trim()
    // "Cena ..?!?" → "Cena?": a run of punctuation that holds a question mark is a question mark
    .replace(/\s*[.?!]*\?[.?!]*/g, '?').replace(/([!])\1+/g, '$1')
  t = t.charAt(0).toUpperCase() + t.slice(1)
  return t
}

/** Is this comment something a customer would send the business as a first message? */
export function usable(text) {
  const t = String(text || '')
  if (t.length < 4 || t.length > 130 || NOISE.test(fold(t)) || NOT_SERBIAN.test(fold(t))) return false
  return /[?]/.test(t) || PRICE_Q.test(fold(t)) || DELIVERY_Q.test(fold(t))
}

const STOP = new Set(['na', 'za', 'sa', 'od', 'do', 'po', 'uz', 'iz', 'je', 'li', 'da', 'se', 'su', 'ili', 'i', 'u'])
const stems = (s) => (fold(s).match(/[a-z0-9]+/g) || []).filter((w) => /\d/.test(w) || (w.length >= 3 && !STOP.has(w))).map((w) => w.slice(0, 5))

/** The catalogue item a text talks about (a post caption or the question itself), or null. */
export function itemIn(text, catalog) {
  const have = new Set(stems(text))
  let best = null
  for (const it of (catalog || []).filter((c) => c.name)) {
    for (const phrase of [it.name, ...String(it.name).split(/\s*[\/–-]\s*/)]) {
      const need = [...new Set(stems(phrase))]
      const hit = need.filter((x) => have.has(x)).length
      if (!need.length || hit / need.length < 0.75) continue
      const score = hit / need.length + hit * 0.01
      if (!best || score > best.score) best = { item: it, score }
    }
  }
  return best?.item || null
}

/**
 * The hero's first message, decided from the business's own customers.
 * @returns {{ text: string, kind: 'post_reply'|'dm', post: {shortcode:string, caption:string, image:string|null}|null, item: object|null, source: 'customers'|'fallback' }}
 */
export function pickOpening(voice, { catalog = [], fallbackText }) {
  const posts = new Map((voice?.posts || []).map((p) => [p.shortcode, p]))
  const candidates = (voice?.questions || [])
    .filter((q) => usable(q.text))
    .map((q) => {
      const post = posts.get(q.shortcode) || null
      const captionItem = post ? itemIn(post.caption, catalog) : null
      const item = itemIn(q.text, catalog) || captionItem
      // a reply to a post only when the question is about what the post shows: it points at it
      // ("cena ovog kontejnera") or the post names a catalogue item and the question asks its price
      const aboutPost = !!post?.image && (q.points_at_item || (!!captionItem && PRICE_Q.test(fold(q.text))))
      const spec = /\d|m2|m²|kvadrat/.test(fold(q.text))
      const score = (item ? 3 : 0) + (aboutPost ? 2 : 0) + (q.points_at_item ? 1 : 0) + (spec ? 1 : 0) + (PRICE_Q.test(fold(q.text)) ? 1 : 0)
        - (q.text.length > 90 ? 1 : 0) - (VAGUE.test(fold(q.text)) ? 3 : 0) - (/^\W/.test(q.text) ? 1 : 0)
      return { q, post, item, aboutPost, score }
    })
    .sort((a, b) => b.score - a.score)
  const best = candidates[0]
  // the agent must be able to answer it: about a catalogue item, or about the post it sits under
  if (!best || best.score < 3 || (!best.item && !best.aboutPost)) return { text: fallbackText, kind: 'dm', post: null, item: null, source: 'fallback' }
  return {
    text: cleanQuestion(best.q.text),
    kind: best.aboutPost ? 'post_reply' : 'dm',
    post: best.aboutPost ? { shortcode: best.post.shortcode, caption: best.post.caption, image: best.post.image || null } : null,
    item: best.item,
    source: 'customers',
  }
}

/** What really holds this business's customers back, in their words — or null. */
export function pickObjection(voice) {
  const qs = (voice?.questions || []).map((q) => q.text).filter((t) => usable(t) || INSTALMENTS.test(fold(t)))
  const rates = qs.find((t) => INSTALMENTS.test(fold(t)) && t.length <= 60)
  if (rates) return { kind: 'instalments', text: cleanQuestion(rates) }
  return null
}

/** A follow-up the business's customers ask after the price (delivery to their place, etc.), or null. */
export function pickFollowUp(voice, opening) {
  const q = (voice?.questions || []).map((x) => x.text).find((t) => usable(t) && DELIVERY_Q.test(fold(t)) && cleanQuestion(t) !== opening?.text && t.length <= 90)
  return q ? cleanQuestion(q) : null
}

/** A hand-chosen opening from the lead's sheet (sheets/<email>.json → hero) wins over the automatic pick. */
export function openingFromOverride(override, voice, catalog) {
  if (!override?.text) return null
  const post = override.shortcode ? (voice?.posts || []).find((p) => p.shortcode === override.shortcode) : null
  const item = override.item ? (catalog || []).find((c) => c.name === override.item) || null : null
  return { text: override.text, kind: post?.image ? 'post_reply' : 'dm', post: post ? { shortcode: post.shortcode, caption: post.caption, image: post.image || null } : null, item, source: 'manual' }
}
