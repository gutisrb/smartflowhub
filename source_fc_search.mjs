#!/usr/bin/env node
/**
 * source_fc_search.mjs — NEW leads without Apify, from Firecrawl's web search (2026-11-14, when every Apify and ScrapeCreators key was spent).
 *
 * Google-style search for Instagram posts where a shop tells buyers to order in the inbox ("poruči u inbox" + a product), then:
 *   search (2 credits per query) → the post's owner (Instagram pages cost several credits each, not 1: measured 2026-11-14) → the profile page (1 credit: followers, bio, website, recent reels)
 *   → 15k-200k followers, past the profile check (lib/lead-profile.mjs), real reach → email via the layered finder → inserted at 'sourced'.
 * Nothing here decides anything for Nikola: `node queue_for_review.mjs --apply` runs the checks and the judge and fills Station 1.
 *
 * The query list is deliberately broad: DM phrases × many product families, rotated so a run never repeats the last one. It is NOT niche-anchored,
 * which is how the earlier lists ended up furniture-heavy (explore/exploit rewarded whatever had worked: nameštaj po meri 3 of 3 runs).
 *
 *   node source_fc_search.mjs                 12 queries, inserts
 *   node source_fc_search.mjs --queries 6 --dry
 */
import fs from 'fs'
import { fcCharge, fcSpent, fcCap } from './lib/fc-budget.mjs'
import { createClient } from '@supabase/supabase-js'
import { profileFit } from './lib/lead-profile.mjs'
import { parseProfile, parseHeader } from './lib/fc-profile.mjs'
import { findEmail } from './lib/email-finder.mjs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
for (const [key, val] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = val
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const NQ = Number(arg('--queries', 12)), DRY = process.argv.includes('--dry')
const TODAY = new Date().toISOString().slice(0, 10)
const STATE = 'fc_search_state.json'

const PHRASES = ['poruči u inbox', 'porudžbine putem poruke', 'za porudžbine pišite u inbox', 'pošaljite poruku za cenu', 'DM za porudžbinu', 'cena u inbox', 'naručite putem poruke', 'pišite nam za ponudu']
const PRODUCTS = ['Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Čačak', 'Kraljevo', 'Valjevo', 'Šabac', 'Pančevo', 'Zrenjanin', 'Leskovac'] // cities, NOT business types (Nikola 2026-11-11 / 11-15)

let state = { next: 0 }
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')) } catch {}
const queries = Array.from({ length: NQ }, (_, i) => `site:instagram.com "${PHRASES[(state.next + i) % PHRASES.length]}" ${PRODUCTS[(state.next + i * 3) % PRODUCTS.length]} Srbija`)

let last = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function fc(path, body) { // Firecrawl allows 10 requests a minute on this plan
  if (!fcCharge(path === 'search' ? 'search' : 'instagram')) { console.log('Stopping: Firecrawl budget for this run is used up.'); process.exit(1) }
  const wait = last + 6500 - Date.now(); if (wait > 0) await sleep(wait); last = Date.now()
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`https://api.firecrawl.dev/v2/${path}`, { method: 'POST', headers: { authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })
    if (r.status === 429) { await sleep(20000); continue }
    if (r.status === 402) { console.log('\nFirecrawl is OUT OF CREDITS: stopping. Instagram pages cost several credits each (the balance endpoint lags), so check the real balance before a bulk run.'); process.exit(1) }
    return r.json().catch(() => ({}))
  }
  return {}
}
const credits = async () => (await (await fetch('https://api.firecrawl.dev/v2/team/credit-usage', { headers: { authorization: `Bearer ${env.FIRECRAWL_API_KEY}` } })).json()).data?.remainingCredits

const known = new Set()
for (let from = 0; ; from += 1000) { const { data } = await sb.from('contacts').select('instagram_handle').eq('client_id', SF).range(from, from + 999); for (const r of data || []) if (r.instagram_handle) known.add(r.instagram_handle.toLowerCase()); if (!data || data.length < 1000) break }

const before = await credits()
console.log(`${queries.length} queries, ${known.size} accounts already in the DB, ${before} Firecrawl credits\n`)

// 1. search → posts
const posts = new Map() // shortcode -> { url, query }
for (const q of queries) {
  const j = await fc('search', { query: q, limit: 10, country: 'RS', lang: 'sr' })
  const hits = (j.data?.web || j.data || []).filter((x) => /instagram\.com\/(p|reel)\/[\w-]+/.test(x.url || ''))
  for (const x of hits) { const m = /instagram\.com\/(?:p|reel)\/([\w-]+)/.exec(x.url); if (m && !posts.has(m[1])) posts.set(m[1], { url: `https://www.instagram.com/p/${m[1]}/`, query: q }) }
  console.log(`  ${String(hits.length).padStart(2)} posts  ${q.slice(0, 80)}`)
}
console.log(`\n${posts.size} distinct posts`)

// 2. post → owner
const owners = new Map() // handle -> query
for (const [code, p] of posts) {
  const j = await fc('scrape', { url: p.url, formats: ['markdown'], waitFor: 1500 })
  const h = /\(@([\w.]+)\)/.exec(j.data?.markdown || '')?.[1]?.toLowerCase()
  if (h && !owners.has(h)) owners.set(h, p.query)
}
const fresh = [...owners.keys()].filter((h) => !known.has(h))
console.log(`${owners.size} distinct accounts, ${fresh.length} new to the DB\n`)

// 3. profile → band → profile check → reach → email → insert
const rows = []
for (const h of fresh) {
  const j = await fc('scrape', { url: `https://www.instagram.com/${h}/`, formats: ['markdown'], waitFor: 2000 })
  const md = j.data?.markdown || ''
  if (!md) { console.log(`  no  @${h.padEnd(26)} profile not readable`); continue }
  const p = parseProfile(md), hd = parseHeader(md)
  const band = p.followers != null && p.followers >= 15000 && p.followers <= 200000
  const fit = profileFit({ name: hd.fullName || h, bio: hd.bio, followers: p.followers, website: hd.website })
  const reach = p.reelsSeen >= 3 && p.medViews >= 15000
  const ok = band && fit.pass && reach
  console.log(`  ${ok ? 'OK ' : 'no '} @${h.padEnd(26)} ${String(p.followers ?? '?').padStart(7)} reels ${String(p.reelsSeen).padStart(2)} med ${String(p.medViews ?? '-').padStart(7)}  ${hd.website ? 'site' : 'no site'}  ${ok ? '' : !band ? 'outside 15k-200k' : !fit.pass ? fit.fails[0].slice(0, 60) : 'reach under 15k or thin sample'}`)
  if (ok) rows.push({ h, p, hd })
}

console.log(`\n${rows.length} new candidates; finding emails…`)
for (const x of rows) {
  const lead = { email: x.hd.email, website: x.hd.website, company_name: x.hd.fullName || x.h, intake_data: { enrichment: { instagram_profile: { bio: x.hd.bio } } } }
  x.email = x.hd.email || (x.hd.website ? (await findEmail(lead, { hunter: false })).email : null)
  console.log(`  @${x.h.padEnd(26)} ${x.email || '(no email)'}`)
}
const after = await credits()
if (!DRY) {
  for (const { h, p, hd, email } of rows) {
    const { error } = await sb.from('contacts').insert({ client_id: SF, company_name: hd.fullName || h, name: hd.fullName || h, instagram_handle: h, instagram_followers: p.followers, website: hd.website, email, service: 'social_media_system', izvor: 'fc_search',
      pipeline_stage: 'sourced', status: email ? 'enriched' : 'No Draft', comment: `${TODAY}: found by Firecrawl search ("${owners.get(h)}") via source_fc_search.mjs`,
      intake_data: { enrichment: { instagram_profile: { username: h, followers: p.followers, bio: hd.bio, external_url: hd.website } }, reach_fc: { at: TODAY, source: 'firecrawl-profile-12', followers: p.followers, reelsSeen: p.reelsSeen, postsSeen: p.postsSeen, medViews: p.medViews, maxViews: p.maxViews, daysSincePost: p.daysSincePost, postsLast30: p.postsLast30, reelsLast30: p.reelsLast30 }, sourced_by: { query: owners.get(h), at: TODAY } } })
    if (error) console.log('  insert error', h, error.message)
  }
  state.next = (state.next + NQ) % (PHRASES.length * PRODUCTS.length)
  fs.writeFileSync(STATE, JSON.stringify(state))
}
console.log(`\n${DRY ? '[dry run] ' : ''}${rows.length} inserted at 'sourced' (${rows.filter((r) => r.email).length} with an email, ${rows.filter((r) => r.hd.website).length} with a website) · credits used ${before - after} (${after} left)`)
console.log('Next: node queue_for_review.mjs --apply   (checks, judge, caps, then Station 1)')
