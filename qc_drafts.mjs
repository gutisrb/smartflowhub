// Draft quality gate. Three classes of check, because banned-word matching alone
// let "kompanijama koje su u fazi rasta" through: it contained no banned word, it was
// simply vague and presumptuous.
import { createClient } from '@supabase/supabase-js'
import { redFlags } from './lib/copy-red-flags.mjs'
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'

const BANNED = [
  [/četbot|chatbot|\bbot\b|\balat\b|automatizacij|leadov/i, 'vocab'],
  [/gradimo|napravili smo|koji predlažemo|radije pokažemo/i, 'we-as-subject'],
  [/pratilac|pratilaca|aktivnih oglasa|broj oglasa/i, 'targeting metric'],
  [/od nule|gotov\w* šablon/i, 'built-from-scratch'],
  [/168|minimalac|minimaln\w+ zarad/i, 'labour math'],
  [/nalog je već postavljen/i, 'gift subject'],
  [/napredn\w+ AI model/i, 'model-name filler'],
  [/Zdravo [A-ZŠĐČĆŽ]/, 'informal register'],
  [/\bsisteme\b/i, 'plural sistem'],
  [/Meta-verified|storij/i, 'untranslated'],
  [/sumnjiv/i, 'mistranslation'],
  [/sa službom/i, 'sa službom'],
  [/(?<![A-Za-zČĆŽŠĐčćžšđ])(vi|vas|vam|vaš\w*)(?![A-Za-zČĆŽŠĐčćžšđ])/, 'lowercase formal'],
  [/pristup je na linku ispod/i, 'access/CTA conflated'],
]
// Vague where the point is to be specific.
const VAGUE = [
  [/Radimo sa (kompanijama|firmama|biznisima|preduzećima|klijentima|poslovima)\b/i, 'generic noun in opener'],
]
// Claims about their situation we cannot know, and which can offend.
const PRESUMPTION = [
  [/u fazi rasta|koje žele da rastu|koje se šire|koje drže korak|koje se bore|koje ne stižu/i, 'state judgement'],
  [/vaš tim|zatrpan|ne stižete|gubite kupce|propušt\w+ upit/i, 'operational assumption'],
]
// Artifacts the repair pass itself can introduce. Without these, a broken repair ships
// silently — which is how "se Ne zaustavlja" reached a finished draft.
const REPAIR_ARTIFACTS = [
  [/(^|[.!?]\s)se\s/m, 'enclitic opening a clause'],
  [/\bse\s+[A-ZŠĐČĆŽ]/, 'enclitic before capitalised word'],
  [/\b(Naš|naš)\s+sistem\b/, 'we-as-subject possessive'],
  [/[ \t]{2,}|[ \t]+\./, 'whitespace damage'],
]
// The opener must carry the outcome, or paragraph two has nothing to attach to.
const structural = (body) => {
  const s1 = body.split(/(?<=\.)\s/)[0] || ''
  return /:/.test(s1) && /sistem/i.test(s1) ? null : 'opener missing outcome'
}

const { data } = await a.from('contacts')
  .select('company_name,email_draft').eq('client_id', SF).eq('pipeline_stage', 'email_ready')

let bad = 0
for (const c of data) {
  const d = c.email_draft || ''
  const body = d.split('\n').slice(2).join('\n').trim().split('\n').filter(Boolean)[1] || ''
  const hits = [
    ...BANNED.filter(([r]) => r.test(d)).map(([, l]) => l),
    ...VAGUE.filter(([r]) => r.test(d)).map(([, l]) => l),
    ...PRESUMPTION.filter(([r]) => r.test(d)).map(([, l]) => l),
    ...REPAIR_ARTIFACTS.filter(([r]) => r.test(d)).map(([, l]) => l),
    ...redFlags({ subject: d.split('\n')[0], body: d.split('\n').slice(1).join('\n') }).flags,
    structural(body),
  ].filter(Boolean)
  if (hits.length) bad++
  console.log(`${hits.length ? '✗' : '✓'} ${c.company_name.padEnd(34)} ${hits.join(', ')}`)
}
console.log(bad ? `\n${bad} of ${data.length} need work` : `\n✓ all ${data.length} clean (${BANNED.length + VAGUE.length + PRESUMPTION.length + REPAIR_ARTIFACTS.length + 1} checks)`)
process.exit(bad ? 1 : 0)
