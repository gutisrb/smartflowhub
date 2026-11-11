/**
 * collect_customer_voice.mjs — what THIS business's customers actually ask, and where they ask it.
 *
 * Why (Nikola, 2026-10-27): a demo conversation may not assume how customers reach a business.
 * Varmus's customers comment "Cena ovog objekta sa prevozom i montažom, 60km od Novog Sada" under a
 * post of one object, and its captions say "Pošalji nam „SPRAT“ u DM". A dental clinic's patients
 * write "Da li može na rate?" with no post involved. So the demo's opening and objection are taken
 * from the business's own Instagram, per business, never from a template.
 *
 * Reads the lead's public Instagram through ScrapeCreators (~5 credits per lead): recent posts with
 * captions, and the comments under the most-discussed ones. Stores, on the tenant:
 *   onboarding_copy.customer_voice = { handle, fetched_at, posts: [{ shortcode, kind, caption, image,
 *     comments, questions[], dm_keyword }], questions: [{ text, shortcode, points_at_item }] }
 * Post images are saved to public/onboarding/posts/ (Instagram's own URLs expire within days).
 *
 * Usage: node collect_customer_voice.mjs --email varmus.info@gmail.com | --all-pipeline [--posts 5]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipelineTenants } from './lib/pipeline-tenants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SC = process.env.SC_API_KEY
const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d }
const POSTS = Number(arg('--posts', 5))

// same buyer-question pattern as audit_dm_demand.mjs
const BUYER_Q = /(cen[aeuo]\b|cijen|koliko|ko[sš]ta|ima li|imate li|mo[zž]e li|da li (ima|radite|mo[zž]e)|termin|slobodn|dostav|gde se nalaz|kako (da|mogu)|\binfo\b|poslal[ai] sam|odgovorite|\bpp\b|inbox|\bdm\b|rate|rata|garanc|montaž|montaz|prevoz)/i
// "ovog objekta", "ovaj", "ovo" — the question is about the thing in the post, not the business in general
const POINTS_AT_ITEM = /(?<!\p{L})(ov(aj|a|o|og|oj|e|u|og)|ovakv\w*|ovih|taj|ta|to|ovom)(?!\p{L})/iu
// "Pošalji nam „SPRAT“ u DM", "napiši SPRAT u poruci"
// the keyword itself is written in capitals; the verbs may be in any case
const DM_KEYWORD = /(?:[Pp]o[sš]alji(?:te)?|[Nn]api[sš]i(?:te)?)\s+(?:nam\s+)?[„"“']?([A-ZČĆŠŽĐ0-9]{3,20})[“"”']?\s+(?:u\s+)?(?:DM|dm|Dm|inbox|poruk)/

async function sc(path) {
  const r = await fetch(`https://api.scrapecreators.com${path}`, { headers: { 'x-api-key': SC } })
  return r.ok ? r.json() : null
}

async function saveImage(url, name) {
  try {
    const dir = resolve(__dirname, 'public', 'onboarding', 'posts')
    mkdirSync(dir, { recursive: true })
    const file = resolve(dir, `${name}.jpg`)
    if (!existsSync(file)) {
      const r = await fetch(url)
      if (!r.ok) return null
      writeFileSync(file, Buffer.from(await r.arrayBuffer()))
    }
    return `/onboarding/posts/${name}.jpg`
  } catch { return null }
}

async function collect(client) {
  const { data: ct } = await sb.from('contacts').select('instagram_handle').or(`email.eq.${client.email},demo_tenant_email.eq.${client.email}`).limit(1)
  const handle = ct?.[0]?.instagram_handle
  if (!handle) return { error: 'no Instagram handle on the lead' }
  let u = null
  for (let i = 0; i < 3 && !u?.edge_owner_to_timeline_media?.edges?.length; i++) {
    u = (await sc(`/v1/instagram/profile?handle=${encodeURIComponent(handle)}`))?.data?.user
    if (!u?.edge_owner_to_timeline_media?.edges?.length) await new Promise((r) => setTimeout(r, 1500))
  }
  const nodes = (u?.edge_owner_to_timeline_media?.edges || []).map((e) => e.node)
  if (!nodes.length) return { error: u?.is_private ? 'private account' : 'no posts returned' }

  const posts = nodes.map((n) => {
    const caption = (n.edge_media_to_caption?.edges?.[0]?.node?.text || '').replace(/\s+/g, ' ').trim()
    return {
      shortcode: n.shortcode, kind: n.is_video ? 'reel' : 'post', caption: caption.slice(0, 600),
      comments: n.edge_media_to_comment?.count || 0, display_url: n.display_url,
      dm_keyword: caption.match(DM_KEYWORD)?.[1] || null, questions: [],
    }
  })
  const discussed = [...posts].filter((p) => p.comments > 0).sort((a, b) => b.comments - a.comments).slice(0, POSTS)
  for (const p of discussed) {
    const c = await sc(`/v2/instagram/post/comments?url=${encodeURIComponent(`https://www.instagram.com/p/${p.shortcode}/`)}`)
    for (const cm of c?.comments || []) {
      if (cm.user?.username === handle) continue
      const text = String(cm.text || '').replace(/@\S+/g, '').replace(/\s+/g, ' ').trim()
      if (text.length >= 3 && BUYER_Q.test(text)) p.questions.push(text.slice(0, 160))
    }
  }
  // keep images only for posts the demo may show: ones with questions or a DM keyword
  for (const p of posts) {
    if ((p.questions.length || p.dm_keyword) && p.display_url) p.image = await saveImage(p.display_url, `${client.id.slice(0, 8)}-${p.shortcode}`)
    delete p.display_url
  }
  const questions = posts.flatMap((p) => p.questions.map((text) => ({ text, shortcode: p.shortcode, points_at_item: POINTS_AT_ITEM.test(text) })))
  return { handle, fetched_at: new Date().toISOString(), posts, questions }
}

const emails = args.includes('--all-pipeline') ? await pipelineTenants() : [arg('--email')].filter(Boolean)
const { data: clients } = await sb.from('clients').select('id,name,email,onboarding_copy').in('email', emails)
for (const c of clients || []) {
  const voice = await collect(c)
  if (voice.error) { console.log(`${c.name}: ⛔ ${voice.error} — nothing stored`); continue }
  await sb.from('clients').update({ onboarding_copy: { ...(c.onboarding_copy || {}), customer_voice: voice } }).eq('id', c.id)
  const kw = voice.posts.filter((p) => p.dm_keyword).map((p) => p.dm_keyword)
  console.log(`\n${c.name} (@${voice.handle}) · ${voice.posts.length} posts · ${voice.questions.length} buyer questions${kw.length ? ` · DM keywords: ${kw.join(', ')}` : ''}`)
  for (const q of voice.questions.slice(0, 8)) console.log(`   ${q.points_at_item ? '→ item' : '       '} „${q.text}“`)
}
