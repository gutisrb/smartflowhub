#!/usr/bin/env node
/**
 * audit_nosite.mjs — how good are the leads that have no website in the DB, REALLY? (2026-11-14, Nikola: "why did you mention 126 when only 31 are good? are they
 * truly good? double check, I don't want another batch of demos for weak leads".) Read-only, no Firecrawl credits: stored data + the OpenAI judge pair.
 *
 * Evidence tiers for a lead that the judge says is a real business:
 *   A  reach     median reel plays >= 20k (measured)
 *   B  ads       a 60+ day ad AND (3+ live ads, or a message CTA: money spent to start conversations)
 *   C  ad only   a 60+ day ad, 1-2 ads, reach weak or never measured: UNPROVEN
 *   D  nothing   no long ad, no measured reach: nothing says it has traffic
 * "No website" is also tested: an ad whose CTA is Shop now / Learn more / Order now ... links to a web page, so such a lead has a site we did not store.
 */
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { profileFit } from './lib/lead-profile.mjs'
import { judgeAccounts } from './lib/lead-judge.mjs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const k = (n) => (n == null ? '?' : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
const WEB_CTA = /shop now|learn more|order now|sign up|contact us|get offer|apply now|book now|see details|get quote|download|subscribe/i
const MSG_CTA = /send (whats ?app )?message|message us|whatsapp/i

let all = [], from = 0
while (true) {
  const { data, error } = await sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,niche,pipeline_stage,email,website,facebook_page_id,email_1_poslat,intake_data').eq('client_id', SF).range(from, from + 999)
  if (error || !data.length) break
  all = all.concat(data); if (data.length < 1000) break; from += 1000
}
const pool = all.filter((r) => r.instagram_handle && !r.website && !r.email_1_poslat && (r.instagram_followers || 0) >= 15000 && (r.instagram_followers || 0) <= 200000
  && !['discarded', 'sent', 'replied', 'booked', 'email_ready'].includes(r.pipeline_stage) && !r.intake_data?.removed)
console.log(`no-website leads in 15-200k, never emailed, not removed: ${pool.length}\n`)

const sig = (r) => {
  const i = r.intake_data || {}, d = i.dm_demand || {}, a = i.audit || {}, fc = i.reach_fc || {}
  const fcOk = (fc.reelsSeen ?? 0) >= 3
  const since = Date.parse(a.ads?.since || String(i.ad_start_date || '').slice(0, 10))
  return { med: d.median_views ?? a.medViews ?? (fcOk ? fc.medViews : null) ?? null, ads: Number(i.active_ads_count || a.ads?.active || 0), days: Number.isFinite(since) ? Math.round((Date.now() - since) / 864e5) : null, cta: i.ad_cta || '', ig: i.enrichment?.instagram_profile || {} }
}

// 1. judge everything (cached verdicts are reused)
const need = pool.filter((r) => !r.intake_data?.judge)
const fresh = need.length ? await judgeAccounts(need.map((r) => ({ handle: r.instagram_handle, name: r.company_name, category: sig(r).ig.business_category || r.niche, bio: sig(r).ig.bio }))) : new Map()
console.log(`judged ${fresh.size} of ${need.length} new (${pool.length - need.length} cached)`)
const kindOf = (r) => r.intake_data?.judge || fresh.get(r.instagram_handle.toLowerCase()) || null

// 2. tiers
const rows = pool.map((r) => {
  const s = sig(r), j = kindOf(r)
  const prof = profileFit({ name: r.company_name, niche: r.niche, bio: s.ig.bio, category: s.ig.business_category, followers: r.instagram_followers })
  const long = s.ads > 0 && (s.days ?? 0) >= 60
  let tier = 'D'
  if (s.med != null && s.med >= 20000) tier = 'A'
  else if (long && (s.ads >= 3 || MSG_CTA.test(s.cta))) tier = 'B'
  else if (long) tier = 'C'
  const out = !j ? 'unjudged' : j.kind !== 'business' ? `cut:${j.kind}` : !prof.pass ? 'cut:profile' : 'business'
  return { r, s, j, tier, out, long, webCta: WEB_CTA.test(s.cta) }
})
const by = (f) => rows.filter(f).length
console.log('\n=== FUNNEL ===')
console.log(`  ${rows.length} no-website leads`)
console.log(`  - not a real business (judge or profile check): ${by((x) => x.out.startsWith('cut'))}   [${[...new Set(rows.filter((x) => x.out.startsWith('cut')).map((x) => x.out))].join(', ')}]`)
console.log(`  - unjudged: ${by((x) => x.out === 'unjudged')}`)
const biz = rows.filter((x) => x.out === 'business')
console.log(`  = real businesses: ${biz.length}`)
for (const t of ['A', 'B', 'C', 'D']) console.log(`      tier ${t} ${{ A: 'REACH measured >= 20k plays', B: 'ADS 60+ days, 3+ ads or a message CTA', C: 'AD ONLY 60+ days, 1-2 ads, reach weak or never measured', D: 'NOTHING: no long ad, no measured reach' }[t].padEnd(58)} ${biz.filter((x) => x.tier === t).length}`)
console.log(`  of the ${biz.length}: ad CTA drives to a web page (Shop now / Learn more / ...) so they DO have a site we did not store: ${biz.filter((x) => x.webCta).length}; measured at all: ${biz.filter((x) => x.s.med != null).length}; judge pair disagreed: ${biz.filter((x) => x.j?.doubt).length}`)

const show = (x) => console.log(`  ${x.tier} @${x.r.instagram_handle.padEnd(26)} ${k(x.r.instagram_followers).padStart(5)} fol | reach ${k(x.s.med).padStart(5)} | ${String(x.s.ads).padStart(2)} ads ${x.s.days != null ? String(x.s.days).padStart(3) + 'd' : '   ?'} ${(x.s.cta || '-').slice(0, 14).padEnd(14)} | ${x.webCta ? 'has a landing page' : x.r.facebook_page_id ? 'FB page' : '-'.padEnd(10)} | ${(x.s.ig.bio || x.r.niche || '').replace(/\s+/g, ' ').slice(0, 48)}${x.j?.doubt ? '  [models disagree: ' + x.j.doubt + ']' : ''}`)
console.log('\n=== TIER A and B (the only ones with real evidence) ===')
for (const x of biz.filter((x) => x.tier === 'A' || x.tier === 'B').sort((a, b) => (b.s.med ?? 0) - (a.s.med ?? 0) || b.s.ads - a.s.ads)) show(x)
console.log('\n=== TIER C sample (unproven: one ad, nothing else) ===')
for (const x of biz.filter((x) => x.tier === 'C').slice(0, 12)) show(x)
console.log('\n=== CUT by the judge / profile check (what the 31 contained) ===')
for (const x of rows.filter((x) => x.out.startsWith('cut') && (x.tier === 'A' || x.tier === 'B' || x.tier === 'C')).slice(0, 14)) console.log(`  ${x.out.padEnd(18)} @${x.r.instagram_handle.padEnd(26)} ${(x.j?.reason || '').slice(0, 70)}`)
// save verdicts so nothing is paid for twice
let saved = 0
for (const x of rows) if (x.j && !x.r.intake_data?.judge) { const { error } = await sb.from('contacts').update({ intake_data: { ...(x.r.intake_data || {}), judge: { ...x.j, at: new Date().toISOString().slice(0, 10) } } }).eq('id', x.r.id); if (!error) saved++ }
fs.writeFileSync('audit_nosite.json', JSON.stringify(rows.map((x) => ({ handle: x.r.instagram_handle, followers: x.r.instagram_followers, tier: x.tier, out: x.out, med: x.s.med, ads: x.s.ads, days: x.s.days, cta: x.s.cta, doubt: x.j?.doubt || null })), null, 2))
console.log(`\nsaved ${saved} new judge verdicts · full table in audit_nosite.json`)
