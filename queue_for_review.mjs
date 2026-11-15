#!/usr/bin/env node
/**
 * queue_for_review.mjs — the ONE list Nikola decides from.
 *
 * Every lead that deserves a decision lands in Station 1 of the Command Center ("Novi leadovi", pipeline_stage 'novi') with its numbers and
 * flags on one line; everything else is archived and never shown. Nothing reaches him that fails the common-sense checks
 * (lib/lead-sanity.mjs: market, chain) or the what-it-sells check (lib/lead-profile.mjs), and no lead is ever deleted. He clicks Odobri
 * (demo gets built) or Odbaci ('discarded': never comes back).
 *
 *   node queue_for_review.mjs            dry run: prints the queue and the cut list, writes nothing
 *   node queue_for_review.mjs --apply    writes pipeline_stage + intake_data.review
 *   --cap N                              show at most N leads in the queue (default 30), strongest first
 */
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { leadFit, isStrongMessageAd } from './lib/lead-fit.mjs'
import { profileFit } from './lib/lead-profile.mjs'
import { marketCheck, chainCheck, fetchSiteText, remoteSalesCheck } from './lib/lead-sanity.mjs'
import { judgeAccounts } from './lib/lead-judge.mjs'
import { familyOf } from './lib/lead-family.mjs'
import { ownDomain } from './lib/email-finder.mjs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
for (const [key, val] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = val // the LLM adapter reads GEMINI_API_KEY from the environment
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const APPLY = process.argv.includes('--apply')
const CAP = Number(arg('--cap', 20))
const FAMILY_CAP = Number(arg('--family-cap', 999)) // at most this many leads of one business family in the queue: no niche takes over the list (the furniture bias)
const SUSTAINED_DAYS = 60
const TODAY = new Date().toISOString().slice(0, 10)

// Leads Nikola removed by his own words (2026-11-13); written once as intake_data.removed, after which the data drives it.
const REMOVED_BY_NAME = { topdek_: 'no traffic, no results', industrija_bg: 'not worth it (about 5k views on his screen)', 'italijanski.namestaj.emmeti': 'not ICP: "doesn\'t make sense to outreach to EMMETI"' }
const ACTIVE = new Set(['email_ready', 'sent', 'replied', 'booked'])
const DEAD = new Set(['Disqualified', 'Lost', 'Bounced'])
const okMail = (e) => !!e && !/@(email|website|example)\./.test(e)
const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
const sustainedOf = (s) => s.ads > 0 && s.adsSinceDays != null && s.adsSinceDays >= SUSTAINED_DAYS
// Evidence of real conversations, honest about how much we know (2026-11-14, Nikola: "why would I need weak leads?"):
//   A reach measured >= 20k median plays · B a 60+ day ad whose CTA STARTS a conversation (Send message), or a public inbox-overload admission
//   M reach 8-20k lifted by a 60+ day ad of any kind · W anything else: NOT SHOWN (a long Learn-more / Shop-now ad alone sends people to a web page and proves nothing)
const strongMsg = (s) => isStrongMessageAd({ ads: s.ads, days: s.adsSinceDays, cta: s.cta })
const tierOf = (s, ov) => (s.med != null && s.med >= 20000 ? 'A' : (ov || strongMsg(s)) ? 'B' : (s.med != null && s.med >= 8000 && sustainedOf(s)) ? 'M' : 'W')
const TIER_ORDER = { A: 0, B: 1, M: 2, W: 3 }

// public overload admissions found by the old DM-demand audits ("zbog velikog broja pitanja u inbox-u poruke ne stignu"): direct proof of influx
const overload = new Map()
for (const f of fs.readdirSync('.').filter((n) => /^dm_demand.*\.json$/.test(n))) {
  try { for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) if (r.handle && r.overload?.length) overload.set(String(r.handle).toLowerCase(), r.overload[0]) } catch {}
}

let all = [], from = 0
while (true) {
  const { data, error } = await sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,niche,pipeline_stage,status,comment,email,website,demo_tenant_url,email_1_poslat,intake_data').eq('client_id', SF).range(from, from + 999)
  if (error || !data.length) break
  all = all.concat(data); if (data.length < 1000) break; from += 1000
}

const sig = (r) => {
  const i = r.intake_data || {}, d = i.dm_demand || {}, a = i.audit || {}, fc = i.reach_fc || {}
  const fcOk = (fc.reelsSeen ?? 0) >= 3 // a Firecrawl read of 1-2 reels is not a measurement (Eterna read 35k from one reel)
  return { med: d.median_views ?? a.medViews ?? (fcOk ? fc.medViews : null) ?? null, r30: a.last30 ?? (fcOk ? fc.reelsLast30 : null) ?? null, last: d.days_since_post ?? a.daysSince ?? fc.daysSincePost ?? null, ads: Number(i.active_ads_count || a.ads?.active || 0), cta: i.ad_cta || '', adSince: a.ads?.since || String(i.ad_start_date || '').slice(0, 10) || '', adsSinceDays: (() => { const d = Date.parse(a.ads?.since || String(i.ad_start_date || '').slice(0, 10)); return Number.isFinite(d) ? Math.round((Date.now() - d) / 864e5) : null })(), bq: a.buyerQs ?? d.buyer_qs ?? null }
}

const stats = { sent: 0, needsContact: [], unmeasured: [], outOfBand: 0, removed: 0 }
const evict = [] // leads already in Station 1 that turn out to have no real website (a Facebook link is not one): they go back to waiting
const pre = []
for (const r of all) {
  if (!r.instagram_handle || ACTIVE.has(r.pipeline_stage)) continue
  if (r.intake_data?.review?.decision) continue // Nikola already decided in the Command Center: approved leads stay where he put them
  if (r.pipeline_stage === 'discarded' || r.intake_data?.removed || REMOVED_BY_NAME[r.instagram_handle]) { stats.removed++; continue }
  if (r.email_1_poslat) { stats.sent++; continue }
  if (r.status === 'Lost' || r.status === 'Bounced') { stats.removed++; continue }
  const f = r.instagram_followers || 0
  if (f < 15000 || f > 200000) { stats.outOfBand++; continue }
  if (!okMail(r.email) || !ownDomain(r.website)) { stats.needsContact.push(r); if (r.pipeline_stage === 'novi') evict.push({ r, why: 'no real website of its own (a Facebook link is not one) or no email: waits' }); continue }
  const s = sig(r)
  if (s.med == null && !strongMsg(s)) { stats.unmeasured.push(r); if (r.pipeline_stage === 'novi') evict.push({ r, why: 'reach never measured: a lead is shown only when measured (or a message ad proves conversations)' }); continue }
  pre.push({ r, s, f })
}

const cut = [], hold = [], cands = [], borderline = []
const weak = []
for (const { r, s, f } of pre) {
  const ig = r.intake_data?.enrichment?.instagram_profile || {}, bio = ig.bio || ''
  const prof = profileFit({ name: r.company_name, niche: r.niche, bio, category: ig.business_category, followers: f, website: r.website })
  if (!prof.pass) { cut.push({ r, s, why: prof.fails[0] }); continue }
  const fit = leadFit({ name: r.company_name, bio, category: ig.business_category, niche: r.niche, followers: f, email: r.email, medViews: s.med, daysSincePost: s.last, activeAds: s.ads || null, adsSinceDays: s.adsSinceDays, adCta: s.cta, reelsLast30: s.r30, override: r.intake_data?.fit_override })
  const ov = overload.get(r.instagram_handle.toLowerCase())
  if (fit.lane === 'remeasure') { hold.push({ r, s, why: fit.fails[0] }); continue }
  if (fit.lane === 'fail') {
    const hard = fit.fails.some((x) => /last reel|sendable email|personal brand|other accounts/.test(x))
    if (!(ov && !hard)) { cut.push({ r, s, why: fit.fails[0] }); continue }
  }
  if (s.med != null && s.med < 20000 && !ov && !sustainedOf(s)) { borderline.push({ r, s }); continue } // 8-20k: scrapers undercount, but 'up the bar': it waits, it is not shown
  const tier = tierOf(s, ov)
  if (tier === 'W') { weak.push({ r, s, why: 'weak evidence: no measured reach >= 20k and no message ad: parked, not shown' }); continue } // also parks leads already in Station 1 that fail the rule
  cands.push({ r, s, f, fit, ig, bio, ov, tier })
}

// site-based checks (free: plain fetches of the lead's own website), a few leads at a time
const queue = []
for (let i = 0; i < cands.length; i += 5) {
  await Promise.all(cands.slice(i, i + 5).map(async (c) => {
    const siteText = await fetchSiteText(c.r.website)
    const mk = marketCheck({ name: c.r.company_name, bio: c.bio, website: c.r.website, siteText })
    const ch = chainCheck({ name: c.r.company_name, bio: c.bio, siteText, followers: c.f, ads: c.s.ads })
    if (mk.verdict === 'fail') return void cut.push({ ...c, why: mk.reason })
    if (ch.verdict === 'fail') return void cut.push({ ...c, why: ch.reason })
    { const rs = remoteSalesCheck(siteText); if (siteText.length > 1500 && rs.evidence.length === 0) return void cut.push({ ...c, why: 'sells nothing remotely: no delivery, cart, order or booking word on its own site' }) }
    const flags = []
    const long = sustainedOf(c.s) // a long-running ad is the traffic evidence: weak reels or rare posting are not warnings then
    if (!long && c.s.med != null && c.s.med < 8000) flags.push(`pregledi samo ${k(c.s.med)}: prazan nalog?`)
    else if (!long && c.s.med != null && c.s.med < 20000) flags.push(`pregledi ${k(c.s.med)} (granično, proveri grid)`)
    if (!long && c.f < 30000) flags.push(`mali nalog (${k(c.f)}) ali pravi pregledi`)
    if (!long && c.s.last > 60) flags.push(`poslednji reel pre ${c.s.last} dana`)
    if (!long && c.s.r30 != null && c.s.r30 < 2) flags.push(`retko objavljuje (${c.s.r30} reels/30d)`)
    if (c.fit.reviews.some((x) => /appointment service/.test(x))) flags.push('usluga sa zakazivanjem: proveri da li ima šta da se prodaje')
    if (c.ov) flags.push('javno priznaje da im je inbox preopterećen')
    if (mk.verdict === 'review') flags.push('tržište nije potvrđeno')
    if (ch.verdict === 'review') flags.push(ch.reason)
    if (siteText.length > 1500 && !remoteSalesCheck(siteText).ok) flags.push('nema dostave ni online poručivanja ni zakazivanja na sajtu: možda samo fizička prodavnica')
    const au = c.r.intake_data?.audit; if (au && au.medComments === 0 && (au.avgComments ?? 0) < 1) flags.push('nula komentara ispod objava: slab odziv')
    const demo = c.r.demo_tenant_url ? ' · demo već napravljen' : ''
    const sells = ((c.bio || '').length >= 15 ? c.bio : (siteText.slice(0, 160) || c.r.niche || '')).replace(/\s+/g, ' ').trim()
    const sellsCut = Array.from(sells).slice(0, 70).join('').replace(/[\uD800-\uDFFF]/g, '').replace(/\s+/g, ' ').trim()
    const evidence = c.tier === 'A' ? 'DOKAZ JAK' : c.tier === 'B' ? `DOKAZ JAK ${c.ov ? '(javno priznaje preopterećen inbox)' : '(plaćeni oglas vodi u poruke)'}` : 'DOKAZ SREDNJI (pregledi 8-20k + dugi plaćeni oglas)'
    const line = `${sellsCut ? `${sellsCut} — ` : ''}${evidence} · ${c.s.med != null ? `${k(c.s.med)} pregleda (medijana)` : 'pregledi nisu mereni'} · ${c.s.r30 ?? '?'} reels/30d · ${c.s.ads} oglasa${c.s.cta ? ` (${c.s.cta})` : ''}${c.s.ads && c.s.adsSinceDays != null ? ` koji idu ${c.s.adsSinceDays} dana` : ''} · ${k(c.f)} pratilaca${demo}${flags.length ? ` | Pažnja: ${flags.join('; ')}` : ''}`
    queue.push({ ...c, flags, line, market: mk, chain: ch, siteSnippet: siteText.slice(0, 400) })
  }))
}
// personal brand / hub / organization = hard block, read by a model (a word list cannot tell a clinic named after its owner from a person who is the product)
const unjudged = []
const toJudge = queue.filter((c) => !c.r.intake_data?.judge)
const judged = toJudge.length ? await judgeAccounts(toJudge.map((c) => ({ handle: c.r.instagram_handle, name: c.r.company_name, category: c.ig.business_category || c.r.niche, bio: c.bio, site: c.siteSnippet }))) : new Map()
for (let i = queue.length - 1; i >= 0; i--) {
  const c = queue[i]
  const j = c.r.intake_data?.judge || judged.get(c.r.instagram_handle.toLowerCase())
  c.judge = j ? { ...j, at: j.at || TODAY } : null
  if (j && j.kind !== 'business' && j.confidence >= (j.kind === 'corporation' ? 0.7 : 0.6)) { cut.push({ ...c, why: `judge: ${j.kind}: ${j.reason}` }); queue.splice(i, 1) }
  else if (j && j.kind !== 'business') c.flags.push('možda lični nalog ili organizacija: proveri')
  else if (j?.doubt) c.flags.push(`dva modela se ne slažu (${j.doubt}): proveri da li je lični nalog ili lanac`)
  else if (!j) { unjudged.push(c); queue.splice(i, 1); continue } // fail closed: a lead nobody could judge never reaches Nikola, and keeps its stage until it is judged
  if (queue[i] === c) c.line = c.line.replace(/( \| Pažnja: .*)?$/, c.flags.length ? ` | Pažnja: ${c.flags.join('; ')}` : '')
}
const strength = (c) => Math.max(c.s.med ?? 0, sustainedOf(c.s) ? 15000 + Math.min(c.s.adsSinceDays, 365) * 20 : 0)
const byTier = (a, b) => (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) || (strength(b) - strength(a))
queue.sort(byTier)
// cap per business type: OFF by default (2026-11-15, Nikola noticed the pattern and asked where it comes from; he did not ask to restrict any type). --family-cap N only on request.
for (const c of queue) c.family = familyOf(c.r, c.bio)
const famCount = {}, famOverflow = [], kept = []
for (const c of queue) { if (c.family !== 'other' && (famCount[c.family] = (famCount[c.family] || 0) + 1) > FAMILY_CAP) famOverflow.push(c); else kept.push(c) } // queue is already sorted by evidence, strongest first
const shown = kept.slice(0, CAP), overflow = kept.slice(CAP)

console.log(`QUEUE for Nikola (Station 1): ${shown.length} of ${queue.length}${overflow.length ? ` (cap ${CAP}, ${overflow.length} wait)` : ''}${famOverflow.length ? `, ${famOverflow.length} held back by the ${FAMILY_CAP}-per-family cap (${[...new Set(famOverflow.map((c) => c.family))].join(', ')})` : ''}\n`)
for (const [i, c] of shown.entries()) console.log(String(i + 1).padStart(2), ('@' + c.r.instagram_handle).padEnd(30), c.line)
const byWhy = {}; for (const c of cut) { const w = c.why.replace(/[\d,]+/g, '#').slice(0, 60); (byWhy[w] ||= []).push(c.r.instagram_handle) }
console.log(`\nCUT (archived, recoverable): ${cut.length}`)
for (const [w, hs] of Object.entries(byWhy).sort((a, b) => b[1].length - a[1].length).slice(0, 14)) console.log(`  ${String(hs.length).padStart(3)}  ${w.padEnd(62)} ${hs.slice(0, 4).join(', ')}${hs.length > 4 ? ', …' : ''}`)
if (unjudged.length) console.log(`\nWAITING FOR THE JUDGE (Gemini quota used up, not shown, stage unchanged): ${unjudged.length}: ${unjudged.slice(0, 10).map((c) => c.r.instagram_handle).join(', ')}${unjudged.length > 10 ? ', …' : ''}`)
console.log(`\nEVIDENCE in the queue: ${['A', 'B', 'M'].map((t) => `${t} ${queue.filter((c) => c.tier === t).length}`).join(' · ')} | PARKED for weak evidence (never shown): ${weak.length}${weak.length ? ': ' + weak.slice(0, 10).map((w) => w.r.instagram_handle).join(', ') + (weak.length > 10 ? ', …' : '') : ''}${evict.length ? `\nMOVED OUT of Station 1: ${evict.map((e) => e.r.instagram_handle + ' (' + e.why.split(':')[0] + ')').join(', ')}` : ''}`)
console.log(`\nBORDERLINE (8-20k, wait, not shown): ${borderline.length}: ${borderline.slice(0, 12).map((b) => b.r.instagram_handle + ' ' + k(b.s.med)).join(', ')}${borderline.length > 12 ? ', …' : ''}`)
console.log(`\nnot judged: ${stats.unmeasured.length} unmeasured, ${hold.length} thin sample, ${stats.needsContact.length} need an email or website, ${stats.sent} already emailed, ${stats.removed} removed by Nikola, ${stats.outOfBand} outside 15k-200k followers`)

fs.writeFileSync(`queue_${TODAY}.json`, JSON.stringify({ queue: queue.map((c) => ({ handle: c.r.instagram_handle, line: c.line, flags: c.flags })), cut: cut.map((c) => ({ handle: c.r.instagram_handle, why: c.why })) }, null, 2))
if (!APPLY) { console.log('\n[dry run] nothing written. Re-run with --apply.'); process.exit(0) }

let wrote = 0
const put = async (id, patch) => { const { error } = await sb.from('contacts').update(patch).eq('id', id); if (error) console.log('  write failed', id, error.message); else wrote++ }
for (const c of shown) {
  const i = c.r.intake_data || {}
  const patch = { pipeline_stage: 'novi', sledeca_akcija: c.line, intake_data: { ...i, judge: c.judge, review: { at: TODAY, rank: shown.indexOf(c) + 1, line: c.line, flags: c.flags, family: c.family, signals: { followers: c.f, medViews: c.s.med, reels30: c.s.r30, ads: c.s.ads, adsSinceDays: c.s.adsSinceDays, cta: c.s.cta, last: c.s.last, overload: c.ov || null }, sanity: { market: c.market.reason, chain: c.chain.reason } } } }
  if (c.r.status === 'Disqualified') patch.status = 'Novi Lead' // disqualified by an older gate (AOV, vertical whitelist); the current checks supersede it
  await put(c.r.id, patch)
}
for (const b of [...borderline, ...weak, ...overflow, ...famOverflow]) {
  if (['demo_building', 'novi'].includes(b.r.pipeline_stage)) await put(b.r.id, { pipeline_stage: 'sourced', intake_data: { ...(b.r.intake_data || {}), review: { at: TODAY, waiting: true, why: b.why || 'borderline reach (8-20k) or below the shown queue: waits, recoverable' } } })
}
for (const e of evict) await put(e.r.id, { pipeline_stage: 'sourced', intake_data: { ...(e.r.intake_data || {}), review: { at: TODAY, waiting: true, why: e.why } } })
for (const c of cut) {
  if (c.r.pipeline_stage === 'archived') continue
  await put(c.r.id, { pipeline_stage: 'archived', intake_data: { ...(c.r.intake_data || {}), review: { at: TODAY, cut: true, why: c.why } } })
}
for (const r of all) {
  const why = REMOVED_BY_NAME[r.instagram_handle]
  if (why && r.pipeline_stage !== 'discarded') await put(r.id, { pipeline_stage: 'discarded', intake_data: { ...(r.intake_data || {}), removed: { by: 'Nikola', at: '2026-11-13', why } } })
}
console.log(`\napplied: ${wrote} rows written`)
