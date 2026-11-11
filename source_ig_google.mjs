/**
 * source_ig_google.mjs — lead discovery on Apify only (Nikola, 2026-11-11: "forget ScrapeCreators, use Apify").
 *
 * Find the accounts that actually TELL THEIR FOLLOWERS TO WRITE TO THEM in their posts and reels (the behaviour that defines the ICP), not
 * accounts that merely name a niche:
 *   1. Google (apify/google-search-scraper, ~$0.0001 per query) for  site:instagram.com "<DM phrase>" Srbija  → posts/reels whose caption says it
 *   2. apify/instagram-post-scraper resolves each post to its owner account (~free)
 *   3. apify/instagram-profile-scraper (~$0.0023): exact followers, website, business e-mail, bio
 *   4. 15k–200k followers, not already in the DB, profile gate (lib/lead-profile.mjs) → inserted at "novi" with the DM-post count as a good sign
 * Then:  node qualify_new.mjs --hours 2 --apply   (reels reach: ratio OR 20k OR live ad; website; moves to Demo se pravi or archives)
 *
 * Usage: node source_ig_google.mjs [--queries 20] [--pages 3] [--dry]
 * A different query set each run: phrases are rotated through ig_google_state.json so a run never repeats the previous run's queries.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pickApifyToken } from './lib/apify-key.mjs'
import { fetchProfiles } from './lib/reach-apify.mjs'
import { profileFit } from './lib/lead-profile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const NQ = Number(arg('--queries', 20)), PAGES = Number(arg('--pages', 3)), DRY = process.argv.includes('--dry')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// phrases people use when they tell followers to write to them (the restored bio-search list + the wording seen in captions/ads)
const PHRASES = ['pošaljite nam poruku', 'pošaljite poruku', 'cena u inbox', 'DM za cenu', 'DM za cene', 'pišite nam u inbox', 'pišite nam za ponudu', 'za porudžbine pišite',
  'poručite putem poruke', 'poruči u DM', 'porudžbine u DM', 'pošaljite upit', 'upit u DM', 'cena na upit', 'sve informacije u inbox', 'za više informacija pošaljite poruku',
  'javite se u inbox', 'javite nam se u poruku', 'za rezervaciju pišite', 'zakažite besplatnu procenu', 'besplatna konsultacija pošaljite poruku', 'pošaljite fotografije za procenu',
  'pošaljite dimenzije za ponudu', 'za cenu pišite u inbox', 'stanje na upit', 'dostupno na upit', 'informacije u inbox', 'pišite nam na Viber', 'pošaljite nam poruku za ponudu',
  'ponuda u inbox', 'besplatna ponuda poruka', 'kontaktirajte nas u poruci', 'napišite nam poruku', 'za sve informacije u DM']
const stateFile = resolve(__dirname, 'ig_google_state.json')
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { next: 0 }
const picked = Array.from({ length: Math.min(NQ, PHRASES.length) }, (_, i) => PHRASES[(state.next + i) % PHRASES.length])
console.log(`${picked.length} phrases (rotation from ${state.next}):`, picked.slice(0, 4).join(' | '), '…')

const key = await pickApifyToken(0.5, { quiet: true })
if (!key) { console.error('no Apify key with budget'); process.exit(1) }
const call = async (actor, input, maxUsd) => {
  const r = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${key.token}&maxTotalChargeUsd=${maxUsd}&timeout=280`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(290000) })
  if (!r.ok) throw new Error(`${actor} ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.json()
}
// 1. Google: posts whose caption prompts a DM
const queries = picked.map((p) => `site:instagram.com "${p}" Srbija`).join('\n')
const cache = resolve(__dirname, 'ig_google_urls.json')
let urls = new Set()
if (process.argv.includes('--reuse') && existsSync(cache)) urls = new Set(JSON.parse(readFileSync(cache, 'utf8')))
else {
  const pages = await call('apify~google-search-scraper', { queries, resultsPerPage: 30, maxPagesPerQuery: PAGES, countryCode: 'rs', languageCode: 'sr' }, 0.5)
  for (const p of pages) for (const o of p.organicResults || []) { const m = /instagram\.com\/(?:[^/]+\/)?(?:p|reel)\/([A-Za-z0-9_-]{8,})/.exec(o.url || ''); if (m) urls.add(`https://www.instagram.com/p/${m[1]}/`) }
  writeFileSync(cache, JSON.stringify([...urls]))
}
console.log(`google: ${urls.size} posts/reels with a DM-prompting caption`)
// 2. owners
const owners = new Map()
const list = [...urls]
for (let i = 0; i < list.length; i += 40) {
  try {
    for (const x of await call('apify~instagram-post-scraper', { username: list.slice(i, i + 40), resultsLimit: 1 }, 0.4)) if (x.ownerUsername) { const h = x.ownerUsername.toLowerCase(); owners.set(h, (owners.get(h) || 0) + 1) }
  } catch (e) { console.log(`  owner batch ${i / 40 + 1} failed (${String(e.message).slice(0, 70)}), continuing`) }
}
console.log(`owners: ${owners.size} distinct accounts`)
// 3. not already known
const known = new Set()
for (let from = 0; ; from += 1000) { const { data } = await sb.from('contacts').select('instagram_handle').eq('client_id', SF).range(from, from + 999); for (const r of data || []) if (r.instagram_handle) known.add(r.instagram_handle.toLowerCase()); if (!data || data.length < 1000) break }
const fresh = [...owners.keys()].filter((h) => !known.has(h))
console.log(`new to the DB: ${fresh.length} (${owners.size - fresh.length} already known)`)
// 4. exact profile facts → 15k–200k → profile gate
const profiles = await fetchProfiles(fresh, { maxUsd: 0.8 })
const rows = []
for (const h of fresh) {
  const p = profiles.get(h); if (!p) continue
  const fit = profileFit({ name: p.fullName || h, bio: p.bio, category: p.category, followers: p.followers })
  const band = p.followers != null && p.followers >= 15000 && p.followers <= 200000
  console.log(`${band && fit.pass ? 'OK ' : 'no '} @${h.padEnd(26)} ${String(p.followers).padStart(7)}  dm-posts ${owners.get(h)}  ${p.website ? 'site' : 'no site'} ${p.email ? 'email' : '     '} ${band ? (fit.pass ? '' : fit.fails[0].slice(0, 50)) : 'followers outside 15k-200k'}  ${(p.fullName || '').slice(0, 30)}`)
  if (band && fit.pass) rows.push({ h, p })
}
console.log(`\n${rows.length} candidates in band and past the profile gate`)
state.next = (state.next + picked.length) % PHRASES.length; writeFileSync(stateFile, JSON.stringify(state))
if (!DRY) {
  for (const { h, p } of rows) {
    const { error } = await sb.from('contacts').insert({ client_id: SF, company_name: p.fullName || h, name: p.fullName || h, instagram_handle: h, instagram_followers: p.followers, website: p.website, email: p.email, service: 'social_media_system', izvor: 'ig_google_apify',
      pipeline_stage: 'novi', status: p.email ? 'enriched' : 'No Draft', niche: p.category || null, comment: `${new Date().toISOString().slice(0, 10)}: found by Google (caption prompts a DM, ${owners.get(h)} post(s)) via source_ig_google.mjs`, intake_data: { dm_posts: owners.get(h), enrichment: { instagram_profile: { username: h, followers: p.followers, bio: p.bio, business_category: p.category, external_url: p.website } } } })
    if (error) console.log('  insert error', h, error.message)
  }
  console.log(`inserted ${rows.length} at "novi". Next: node qualify_new.mjs --hours 2 --apply`)
}
