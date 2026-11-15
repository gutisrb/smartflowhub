// Is this Instagram account a BUSINESS, or a person / personal brand? (Nikola, 2026-11-14: personal brands are a hard block: "they could be using the
// account personally, for a variety of things". Mr Everything, a real estate agent among other things, got through a word list.)
// Words cannot tell "Cvejanovic" (a dental clinic named after its owner) from "Stefan Farmer" (a person who is the product), so a model reads the bio, name,
// category and the first lines of the website, several accounts per call.
// Engines, in order: OpenAI first when OPENAI_API_KEY has credit (reliable, about a cent per 100 accounts), then the STRONG Gemini models (free tier is
// 20 requests a day per model, so it runs dry). Every verdict records the engine that made it. Weak models are NOT used: see MODELS note below.
import OpenAI from 'openai'
import { makeLlm } from './llm.mjs'

const SYSTEM = `You classify Instagram accounts for a tool that sells an AI sales assistant to BUSINESSES.
For each account choose one kind:
- "business": a company, shop, clinic, studio, manufacturer or brand that sells products or services to customers, even when it is named after its owner's surname (a dental clinic "Cvejanovic", a furniture maker "Vacasa").
- "personal": a person's own profile or personal brand where the PERSON is the product or the account is personal: influencer, coach, mentor, doctor or therapist as a personal brand, author, podcast host, a persona like "Stefan Farmer", or a person who lists several unrelated ventures or other accounts in the bio.
- "organization": media, political party or movement, charity, community, school or academy, event or travel organizer with no product of its own.
- "corporation": a chain, marketplace, national brand or large company with many stores or products and its own support department: a retail chain with dozens of shops, a pharmacy chain, a large online marketplace. A small owner-run shop with one to a few locations is a "business".
Judge from the bio, name, category and website text. If the person is the product, answer "personal". Answer with JSON only:
{"items":[{"handle":"...","kind":"business|personal|organization|corporation","confidence":0.0,"reason":"at most 12 words"}]}`

// gemini-2.5-flash and gemini-3.1-flash-lite were tested against Nikola's labels and are NOT used: 29 of 32, and one miss was Tandem called an
// "organization" with confidence 1.0 (it would have cut a lead he likes). No verdict is better than a wrong hard block: unjudged leads are held back.
// OpenAI models run as a PAIR (2026-11-14, tested on his 32 labels): gpt-4o-mini 26/32 (misses every corporation), gpt-4o 31/32 (lets the eplaneta marketplace through),
// gpt-4.1 31/32 (calls Plus Exclusive, which he approved, a corporation). Each one's miss is different, so a lead is cut only when both agree; a disagreement keeps
// the lead visible with a warning (`doubt`). Cheap: a few cents per 100 accounts.
const OPENAI_MODELS = (process.env.OPENAI_JUDGE_MODELS || 'gpt-4o,gpt-4.1').split(',')
const GEMINI_MODELS = (process.env.GEMINI_JUDGE_MODELS || 'gemini-3.5-flash,gemini-3.6-flash,gemini-3.8-flash').split(',')

function engines() {
  const list = []
  if (process.env.OPENAI_API_KEY && process.env.JUDGE_OPENAI !== '0') {
    for (const m of OPENAI_MODELS) list.push({ name: `openai:${m}`, run: (messages) => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat.completions.create({ model: m, messages, temperature: 0, response_format: { type: 'json_object' } }) })
  }
  for (const m of GEMINI_MODELS) list.push({ name: `gemini:${m}`, run: (messages) => makeLlm({ model: m }).chat.completions.create({ messages, temperature: 0, response_format: { type: 'json_object' } }) })
  return list
}

const dead = new Set() // engines that are out of quota or credit, or do not exist: not tried again in this process

/** @param {{ handle: string, name?: string, category?: string, bio?: string, site?: string }[]} items
 *  @returns {Promise<Map<string, { kind: 'business'|'personal'|'organization'|'corporation', confidence: number, reason: string, engine: string }>>} */
const BIZ = 'business'
/** Two verdicts on one account: equal kinds stand; different kinds = a visible business with a doubt (never a silent hard block). */
function merge(vs) {
  if (vs.length === 1) return vs[0]
  const kinds = new Set(vs.map((v) => v.kind))
  const engine = vs.map((v) => v.engine).join('+')
  if (kinds.size === 1) return { kind: vs[0].kind, confidence: Math.min(...vs.map((v) => v.confidence)), reason: vs[0].reason, engine }
  return { kind: BIZ, confidence: 0.5, reason: vs.map((v) => `${v.engine.split(':')[1]}: ${v.kind}`).join(' / '), engine, doubt: vs.map((v) => v.kind).join(' vs ') }
}

export async function judgeAccounts(items, { batch = 8 } = {}) {
  const out = new Map()
  const all = engines()
  for (let i = 0; i < items.length; i += batch) {
    const chunk = items.slice(i, i + batch).map((x) => ({ handle: x.handle, name: x.name || '', category: x.category || '', bio: String(x.bio || '').slice(0, 400), site: String(x.site || '').slice(0, 400) }))
    let lastErr = null
    const verdicts = new Map() // handle -> [verdict per engine that answered]
    const ask = async (eng) => {
      try {
        const resp = await eng.run([{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(chunk) }])
        const parsed = JSON.parse((resp.choices?.[0]?.message?.content || '').replace(/^```(?:json)?|```$/g, '').trim())
        for (const it of parsed.items || []) if (it?.handle && ['business', 'personal', 'organization', 'corporation'].includes(it.kind)) {
          const h = String(it.handle).toLowerCase(); if (!verdicts.has(h)) verdicts.set(h, [])
          verdicts.get(h).push({ kind: it.kind, confidence: Number(it.confidence) || 0, reason: String(it.reason || ''), engine: eng.name })
        }
        return true
      } catch (e) { lastErr = e; if (/429|quota|credit|billing|401|invalid_api_key|404|not found|invalid argument|503|high demand|timeout|aborted/i.test(String(e.message))) dead.add(eng.name); return false }
    }
    const live = all.filter((e) => !dead.has(e.name))
    const oa = live.filter((e) => e.name.startsWith('openai:')), gm = live.filter((e) => e.name.startsWith('gemini:'))
    let answered = 0
    for (const eng of oa) if (await ask(eng)) answered++ // the OpenAI models answer as a pair
    if (!answered) for (const eng of gm) if (await ask(eng)) { answered++; break } // Gemini is only the fallback, one strong model
    for (const [h, vs] of verdicts) out.set(h, merge(vs))
    if (!answered) console.log(`  judge batch ${i / batch + 1} failed on every engine (${String(lastErr?.message).slice(0, 80)}); those accounts stay unjudged`)
  }
  return out
}
