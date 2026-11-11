// A vertical template (skin reaction, injury, medication) is told only when the business's OWN words are about that vertical.
// The niche label comes from a keyword table in build_demo_tenant.mjs (2026-11-11: a bike shop and a decking maker became "beauty" — "ulice"
// matched "lice" — and a steel-hall maker "fitness", so their third chat was a skin reaction / a shoulder injury). No label decides the story
// alone: no vertical words in the sheet, the catalogue or the posts → the neutral template.
export const VERTICAL_WORDS = {
  beauty: /\bkoz[aeiu]\b|\bkozmet|\btretman|\bfrizer|\bsisanj|\bmanikir|\bmasaz|\bnokt|\blepot|salon lepote|\bestetsk|\blice\b/,
  fitness: /\btrening|\bteretan|\bfitnes|\bgym\b|\btrener|\bvezb|\bpilates|\byoga/,
  dental: /\bzub|stomatolog|ortodon|implant|dental/,
  medical: /\blekar|klinik|ordinacij|\bpregled|terapij|dijagnost|\bzahvat/,
}

export function vetNiche(niche, evidence) {
  const re = VERTICAL_WORDS[niche]
  if (!re) return niche
  const text = String(evidence || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj')
  return re.test(text) ? niche : 'services'
}
