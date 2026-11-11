// Facts a demo may only state when the business's own site states them, found WITHOUT a model.
//
// Written 2026-10-26 after JetSet (used phones, repair, buyback) was given a calendar and 124
// appointments although its homepage says, three times, "Dođi bez zakazivanja" / "bez
// zakazivanja". A keyword probe had counted "booking words: 4" and I never read the sentences:
// all four were negations. So: read the sentence, decide from the sentence, keep the sentence.

const fold = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')

/** Sentences of a page text, original spelling preserved, so a verbatim quote can be shown. */
export function sentencesOf(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\s{2,}|\s[|•·]\s/).map((s) => s.trim()).filter((s) => s.length > 8 && s.length < 400)
}

/**
 * The statement that matches `re` (tested on folded text): the sentence when the page has real
 * sentences, otherwise a verbatim window around the match (menus and cards run together into one
 * long line). Either way the result is a substring of `text`.
 */
export function findStatement(text, re) {
  const s = sentencesOf(text).find((x) => re.test(fold(x)))
  if (s) return s
  const flat = String(text || '').replace(/\s+/g, ' ')
  const f = fold(flat)
  const m = f.match(re)
  if (!m || m.index == null) return null
  // fold() keeps length for Latin text (it only strips combining marks and maps đ→dj, which adds one char)
  const start = Math.max(0, m.index - 60)
  const window = flat.slice(start, m.index + m[0].length + 60).trim()
  return window.length >= 12 ? window : null
}

// "without booking" must win over "booking": decide per sentence, negation first
const NO_BOOKING = /bez\s+(prethodnog\s+)?zakazivanj|zakazivanj\w*\s+(nije|ne)\s+(je\s+)?potreb|nije\s+potreb\w*\s+(prethodno\s+)?zakazivanj|ne\s+morate\s+(da\s+)?zakazuj|ne\s+mora\s+(da\s+)?se\s+zakaz|dodjite\s+bez\s+zakaz|dodji\s+bez\s+zakaz|walk-?in|bez\s+najave|bez\s+rezervacij|bez\s+termina/
const BOOKING = /zakazi\w*|zakazat\w*|zakazuj\w*|zakazivanj\w*|rezervis\w*\s+(svoj\w*\s+)?(termin|mesto|sto|boravak|smestaj|sob\w*|tretman\w*|let|skok)|rezervacij\w*\s+(termin|smestaj|sob)|(promeni|otkazi)\s*\/?\s*(otkazi\s+)?rezervacij|online\s+rezervacij|unesite\s+datum|termin\s+(je\s+)?(potrebno|obavezn)|pozovite\s+(nas\s+)?(za\s+)?termin|booking|prijav\w+\s+(za|na)\s+(termin|pregled|trening|skok)/

/**
 * How customers get served, from the site's own sentences.
 * @returns {{ booking: 'none'|'required'|'unknown', quote: string|null }}
 *  `none` when a sentence says you do NOT need to book; `required` when a sentence tells the
 *  customer to book/reserve and no sentence says otherwise; `unknown` when the site is silent.
 */
export function detectBooking(text) {
  const neg = findStatement(text, NO_BOOKING)
  if (neg) return { booking: 'none', quote: neg }
  const pos = findStatement(text, BOOKING)
  if (pos && !/\b(poslovn|uslov|politik)/.test(fold(pos))) return { booking: 'required', quote: pos }
  return { booking: 'unknown', quote: null }
}

/** Couriers/postal services the business names (never guessed from "dostava"). */
const COURIERS = [
  ['D Express', /\bd\s?express\b/], ['AKS', /\baks\b/], ['Post Express', /post\s?express/], ['BEX', /\bbex\b/],
  ['City Express', /city\s?express/], ['Daily Express', /daily\s?express/], ['Pošta Srbije', /posta\s+srbije/],
]
export function detectCouriers(text) {
  const t = fold(text)
  return COURIERS.filter(([, re]) => re.test(t)).map(([name]) => name)
}

/** Cash on delivery stated on the site. */
export const detectCod = (text) => /pouzec|pouzeć|placanje pri preuzimanju|placanje prilikom preuzimanja/.test(fold(text))

/** A quote is only kept when it really is a substring of what was fetched (whitespace-insensitive). */
export function quoteInText(quote, text) {
  if (!quote) return false
  const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim()
  const q = norm(quote)
  return q.length >= 12 && norm(text).includes(q)
}
