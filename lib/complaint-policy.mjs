// The complaint beat of a shop, from the shop's OWN complaint rule (2026-11-11: Metal-Flex had the same generic "proizvod je stigao oštećen" every demo
// carries; its site says how a complaint is made). The agent repeats the site's sentence and records the case; nothing is invented. No sentence → null,
// and the generic complaint stays flagged by the claims gate until a hand sheet writes one.
const POLICY = /reklamac/i
const ACTION = /(mail|e-?mail|obrazac|obrasc|rok|dana|dan\b|prodavnic|poslat|slanjem|kontaktir|prijav|uložit|ulozit|doneti|donesete|racun|račun)/i
const BAD = /^[\s•\-–]*(obrazac za reklamac|reklamacij[ae]\s*$)/i

export function derivePolicyComplaint(corpus, item = null) {
  const sentences = String(corpus || '').split(/(?<=[.!?])\s+/).map((s) => s.replace(/\s+/g, ' ').trim())
  const pick = sentences
    .filter((s) => POLICY.test(s) && ACTION.test(s) && s.length >= 50 && s.length <= 240 && !BAD.test(s) && /[a-zšđčćž]{4}/i.test(s))
    .sort((a, b) => a.length - b.length)[0]
  if (!pick) return null
  const name = String(item?.name || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const what = name ? `„${name}“` : 'jedan proizvod'
  return {
    ask: `Dobar dan, kupio sam kod Vas ${what} i ne radi kako treba.`,
    answer: `Žao mi je zbog toga. ${pick.replace(/\.$/, '')}. Ja upisujem slučaj, pa mi pošaljite ime i broj telefona.`,
    razlog: 'Reklamacija na kupljen proizvod. Agent je uputio na postupak sa sajta i upisao slučaj. Prosleđeno na rešavanje.',
    source: pick,
  }
}
