/**
 * find_leads.mjs — one sourcing run that stops when TARGET leads pass every check that needs no human, then
 * (with --place) puts them in "Demo se pravi" for Nikola's hand check. Default target 12: "4 per search is not
 * sufficient… i think 12 per run could be a good number" (Nikola, 2026-11-05).
 *
 * Sources, best measured yield first (2026-11-04/05):
 *   backlog  leads already in the DB, 30k-200k followers, never emailed, never demand-checked, no demo built.
 *            21 hand-picked → 9 passed for ~50 credits (~5 per lead). Most were Meta Ads finds that were archived
 *            only because enrichment found no email; nobody looked at them again.
 *   ig       source_ig_bio_search.mjs --dry-run --json (niche terms, no city terms): ~1 credit per term.
 *            The 2026-11-04 run with city terms cost ~125 credits per lead that passed.
 * Gates, cheapest first: free filters → profile, 1 credit (rule 1 reel views ≥ 30% of followers, rule 6 posted in
 * 60 days) → comments, ~3 credits (rule 3 buyer questions) → own website (free) → email (free site scrape).
 * A lead that passed demand but has no website or email is KEPT and shows the gap ("NEMA SAJTA", "nema emaila"):
 * dropping it for that is how the backlog got buried. Rules 4 (ticket), 7 (no national brands) and 8 (Nikola looks)
 * stay with the builder and with him.
 *
 * Every checked backlog row gets its result cached in intake_data.dm_demand, so no lead is paid for twice.
 *
 * Usage: node find_leads.mjs [--target 12] [--max-credits 150] [--sources backlog,ig] [--place]
 *   without --place: prints the leads that pass and writes find_leads_<date>.json; stages are not touched
 *   --place:         inserts / moves them into pipeline_stage demo_building with the check line as sledeca_akcija
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { checkDemand, formatRow, makeScrapeCreators } from './lib/dm-demand.mjs'
import { isPermabanned } from './lib/permaban.mjs'
import { leadFit } from './lib/lead-fit.mjs'
import { profileFit } from './lib/lead-profile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim()
}
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const TARGET = Number(arg('--target', 12))
const MAX_CREDITS = Number(arg('--max-credits', 150))
const SOURCES = arg('--sources', 'backlog,ig').split(',')
const PLACE = process.argv.includes('--place')
const TODAY = new Date().toISOString().slice(0, 10)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sc = makeScrapeCreators(process.env.SC_API_KEY)

// Accounts that are not a business selling to customers through DMs (rule 7 and plain non-fits), by name or bio.
const NOT_A_FIT = /(vesti|portal|informativ|news|radio|\btv\b|showbizz|magazin|stranka|\bsns\b|front|grad beograd|op[sš]tina|telekom|yettel|\bmts\b|a1 ?srbija|\btemu\b|honda|zepter|apoteka|drogerie|\bbank|coach|trener|influenc|blog|podcast|pratioci|prodaja pratilaca)/i
// Link hosts that are not the business's own website.
const NOT_OWN_SITE = /(linktr\.ee|mtr\.bio|beacons\.ai|linkin\.bio|bio\.link|taplink|maps\.app\.goo\.gl|goo\.gl|google\.|instagram\.com|facebook\.com|fb\.me|wa\.me|whatsapp|tiktok|viber|t\.me|lnk\.bio|msha\.ke|campsite\.bio|carrd\.co)/i

const niche = (s = '') => /namešt|namest|kuhinj|krevet|sofa|garnitur|enterijer|tepih|stolar/i.test(s) ? 'furniture'
  : /stomat|dent|zub|ortodon|implant/i.test(s) ? 'dental'
  : /venčan|vencan|bridal|wedding/i.test(s) ? 'vencanja'
  : /klinik|estetsk\w* medic|anti-?ag|regenerat|hirurg/i.test(s) ? 'medical'
  : /salon|laser|kosa|hair|epilac|kozmet|beauty|nokt/i.test(s) ? 'beauty'
  : /travel|putovanj|turist|aranžman/i.test(s) ? 'travel'
  : /nekretnin|realty|stanov/i.test(s) ? 'real-estate' : 'generic'

async function get(url, ms = 10000) {
  try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh)' } }); return r.ok ? await r.text() : null } catch { return null }
}
const tokens = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(t => t.length >= 4)

// Own website: the profile link when it is a real site, else <handle core>.rs / .com when the page title names the business.
async function ownSite(row) {
  const nameToks = new Set([...tokens(row.fullName), ...tokens(row.handle)])
  const ok = async url => { const h = await get(url); const t = h?.match(/<title[^>]*>([^<]*)/i)?.[1] || ''; return h && tokens(t).some(x => nameToks.has(x)) ? url : null }
  if (row.website && !NOT_OWN_SITE.test(row.website)) return (await ok(row.website)) || row.website.replace(/\/$/, '')
  const core = row.handle.toLowerCase().replace(/[._-]?(srbija|serbia|beograd|official|shop|rs|doo)$/g, '').replace(/[^a-z0-9]/g, '')
  for (const u of [`https://${core}.rs`, `https://${core}.com`]) { const hit = await ok(u); if (hit) return hit }
  return null
}
async function siteEmail(site) {
  if (!site) return null
  const html = (await Promise.all(['', '/kontakt', '/contact'].map(p => get(site.replace(/\/$/, '') + p)))).join(' ')
  const found = (html.replace(/&#64;|%40|\[at\]/g, '@').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])
    .filter(e => !/sentry|wix|example|\.(png|jpe?g|webp|svg)$|your|ime@|email@|wordpress|@2x/i.test(e))
  const host = site.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  return found.find(e => e.toLowerCase().endsWith(host)) || found[0] || null
}

// ── candidates ──────────────────────────────────────────────────────────────────────────────────────────────
async function backlog() {
  let all = [], from = 0
  for (;;) {
    const { data, error } = await sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,status,comment,website,email,izvor,intake_data,demo_tenant_email,email_1_poslat,pipeline_stage')
      .eq('client_id', SF).in('pipeline_stage', ['archived', 'sourced', 'novi']).gte('instagram_followers', 15000).lte('instagram_followers', 200000).range(from, from + 999)
    if (error) throw error
    all = all.concat(data); if (data.length < 1000) break; from += 1000
  }
  return all.filter(c => c.instagram_handle && !c.email_1_poslat && !c.demo_tenant_email && !c.intake_data?.dm_demand
      && !isPermabanned({ igHandle: c.instagram_handle }) && !NOT_A_FIT.test(`${c.company_name} ${c.instagram_handle}`)
      && !/telekom|nacionaln|van ICP|AOV gate|Diskvalifikovan/i.test(c.comment || ''))
    // Meta Ads finds with a website first: an advertiser with a site is the closest match to the leads that converted.
    .sort((a, b) => ((b.izvor === 'meta_ads_scrape') + !!b.website) - ((a.izvor === 'meta_ads_scrape') + !!a.website) || b.instagram_followers - a.instagram_followers)
    .map(c => ({ source: 'backlog', id: c.id, handle: c.instagram_handle, name: c.company_name, followers: c.instagram_followers, dbEmail: c.email, dbSite: c.website, row: c }))
}
/**
 * Google Maps finds (source_google_maps.mjs, high-ticket verticals) that have a website but no Instagram handle yet. The handle comes
 * from the business's own site (free), then ONE profile check (1 credit) gives followers + reels for the gates.
 */
async function mapsLeads() {
  const since = new Date(Date.now() - 3 * 864e5).toISOString()
  const { data } = await sb.from('contacts').select('id,company_name,website,niche,email,intake_data').eq('client_id', SF).eq('izvor', 'google_maps').is('instagram_handle', null).not('website', 'is', null).gte('created_at', since)
  const out = []
  for (const c of data || []) {
    if (c.intake_data?.dm_demand || isPermabanned({ website: c.website })) continue
    const html = await get(/^https?:/.test(c.website) ? c.website : `https://${c.website}`, 12000)
    const h = html && [...html.matchAll(/instagram\.com\/([A-Za-z0-9._]{3,30})/gi)].map(m => m[1]).find(x => !/^(p|reel|reels|explore|accounts|stories|share|sharer|tv|embed)$/i.test(x))
    if (h) out.push({ source: 'maps', id: c.id, handle: h, name: c.company_name, followers: null, dbEmail: c.email, dbSite: c.website, row: c })
    else console.log(`  · ${String(c.company_name).slice(0, 40).padEnd(40)} no Instagram link on its website`)
  }
  return out
}
function igSearch() {
  const out = join(mkdtempSync(join(tmpdir(), 'find-leads-')), 'ig.json')
  console.log('  running source_ig_bio_search.mjs --dry-run (niche terms only)…')
  execFileSync('node', [resolve(__dirname, 'source_ig_bio_search.mjs'), '--dry-run', '--json', out], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 40 * 60 * 1000 })
  if (!existsSync(out)) return []
  return JSON.parse(readFileSync(out, 'utf8')).filter(p => !NOT_A_FIT.test(`${p.name} ${p.bio}`))
    .map(p => ({ source: 'ig', handle: p.handle, name: p.name, bio: p.bio, followers: p.followers, term: p.term }))
}

// ── run ─────────────────────────────────────────────────────────────────────────────────────────────────────
const startCredits = (await sc('/v1/instagram/profile?handle=x'))?.credits_remaining ?? null
const spent = () => startCredits !== null && sc.credits() !== null ? startCredits - sc.credits() : 0
console.log(`find_leads: target ${TARGET} · max ${MAX_CREDITS} credits · sources ${SOURCES.join(',')} · ${PLACE ? 'PLACE into Demo se pravi' : 'report only'} · ScrapeCreators credits: ${startCredits}`)

const passed = [], checked = []
let skippedProfile = 0
for (const source of SOURCES) {
  if (passed.length >= TARGET) break
  const cands = source === 'backlog' ? await backlog() : source === 'ig' ? igSearch() : source === 'maps' ? await mapsLeads() : []
  console.log(`\n── ${source}: ${cands.length} candidates`)
  for (const c of cands) {
    if (passed.length >= TARGET) break
    if (spent() + 4 > MAX_CREDITS || (sc.credits() !== null && sc.credits() < 4)) { console.log(`  ⏹ credit cap reached (${spent()} spent, ${sc.credits()} left)`); break }
    // 2026-11-11 quality bar (Nikola: "I like the OG batch… all future leads over that quality; not corporations, clients that can afford it
    // and have visible evidence of value"): the business must be a high-consideration vertical, owner-run (lib/lead-profile.mjs), checked
    // for free BEFORE a credit is spent; then reach decides (lib/lead-fit.mjs), not the old comment tiers that let two bridal shops, a
    // laser studio and a hair-extension shop through.
    const pre = profileFit({ name: c.name, bio: c.bio || c.row?.niche, followers: c.followers })
    if (!pre.pass) { skippedProfile++; if (skippedProfile <= 12) console.log(`  ✗ ${String(c.name).slice(0, 34).padEnd(34)} (profile, free) ${pre.fails[0]}`); continue }
    const r = await checkDemand(sc, { handle: c.handle, followers: c.followers, name: c.name }, { comments: false })
    checked.push({ ...c, row: undefined, result: r })
    console.log('  ' + formatRow(r))
    if (c.source === 'backlog' || c.source === 'maps') {
      await sb.from('contacts').update({ ...(c.source === 'maps' ? { instagram_handle: c.handle, instagram_followers: r.followers } : {}), intake_data: { ...(c.row.intake_data || {}), dm_demand: { checked_at: TODAY, tier: r.tier, why: r.why || null,
        views_per_follower: r.viewsPerFollower, median_views: r.medViews, median_comments: r.medComments, buyer_qs: r.buyerQs, sample_qs: r.sampleQs, days_since_post: r.daysSincePost } } }).eq('id', c.id)
    }
    const fit = leadFit({ followers: r.followers, medViews: r.medViews, viewsPerFollower: r.viewsPerFollower, reels12: r.reels12, dmPrompt: !!(r.inviteBio || r.inviteCaps >= 1) }, { requireEmail: false })
    const prof = profileFit({ name: r.fullName || c.name, bio: r.bio, category: r.category, followers: r.followers })
    if (!fit.pass || !prof.pass || (r.followers || 0) < 15000) { console.log(`     ✗ ${[...fit.fails, ...prof.fails].join(' | ').slice(0, 150)}`); continue }
    const site = await ownSite(r) || (c.dbSite && !NOT_OWN_SITE.test(c.dbSite) ? c.dbSite : null)
    // every lead of the original batch has its own website: no site, no demo can be built from it
    if (!site) { console.log('     ✗ no own website found'); continue }
    const email = c.dbEmail || r.bioEmail || await siteEmail(site)
    passed.push({ ...c, row: undefined, r, site, email, niche: niche(`${r.fullName} ${r.bio} ${r.category}`) })
    console.log(`     ✓ pass ${passed.length}/${TARGET} · site ${site || '—'} · email ${email || '—'}`)
  }
}

const line = p => {
  const r = p.r
  const views = r.viewsPerFollower >= 1 ? `pregledi ${r.viewsPerFollower.toFixed(1)}× pratilaca` : `pregledi ${Math.round(r.viewsPerFollower * 100)}% pratilaca`
  const qs = r.buyerQs ? `${r.buyerQs} pitanja kupaca ispod objava` : r.overload?.length ? 'u objavama piše da ne stižu da odgovore' : 'nema pitanja kupaca u komentarima'
  return `Proveri: ${views} · ${qs} · objava pre ${r.daysSincePost}d${p.site ? ' · sajt ✓' : ' · NEMA SAJTA'}${p.email ? ' · email ✓' : ' · nema emaila'}`
}

console.log(`\n═══ ${passed.length}/${TARGET} passed · ${checked.length} checked · ${spent()} credits spent · ${sc.credits()} left`)
const bySource = {}; for (const c of checked) { const s = bySource[c.source] ||= { checked: 0, passed: 0 }; s.checked++ }
for (const p of passed) bySource[p.source].passed++
for (const [s, v] of Object.entries(bySource)) console.log(`  ${s}: ${v.passed}/${v.checked} passed`)
for (const p of passed) console.log(`  ${p.r.tier} ${String(p.r.fullName || p.name).slice(0, 36).padEnd(36)} @${p.handle.padEnd(26)} ${line(p)}${p.term ? `  [term: ${p.term}]` : ''}`)
writeFileSync(resolve(__dirname, `find_leads_${TODAY}.json`), JSON.stringify({ passed, checked: checked.map(c => ({ source: c.source, handle: c.handle, tier: c.result.tier, why: c.result.why })) }, null, 2))

if (PLACE) {
  for (const p of passed) {
    const f = p.r.followers
    const base = { pipeline_stage: 'demo_building', instagram_followers: f, niche: p.niche, website: p.site, email: p.email, sledeca_akcija: line(p),
      kategorija: f >= 50000 ? 'Vreo' : 'Topao', status: p.email ? 'enriched' : 'No Draft' }
    const evidence = { checked_at: TODAY, tier: p.r.tier, views_per_follower: p.r.viewsPerFollower, median_views: p.r.medViews, median_comments: p.r.medComments,
      buyer_qs: p.r.buyerQs, sample_qs: p.r.sampleQs, days_since_post: p.r.daysSincePost, overload: p.r.overload }
    if (p.source === 'backlog' || p.source === 'maps') {
      const { data: cur } = await sb.from('contacts').select('intake_data,comment,pipeline_stage,status').eq('id', p.id).single()
      const { error } = await sb.from('contacts').update({ ...base, intake_data: { ...(cur.intake_data || {}), dm_demand: evidence },
        comment: `${cur.comment ? cur.comment + ' | ' : ''}${TODAY}: iz ${cur.pipeline_stage}/${cur.status} u „Demo se pravi“ na Nikolinu proveru (find_leads).` }).eq('id', p.id)
      console.log(error ? `  ERR ${p.handle} ${error.message}` : `  placed ${p.handle}`)
    } else {
      const { error } = await sb.from('contacts').insert({ ...base, client_id: SF, company_name: p.r.fullName || p.handle, name: p.r.fullName || p.handle,
        instagram_handle: p.handle, service: 'social_media_system', izvor: 'ig_bio_search_scrapecreators',
        comment: `${TODAY}: novi lead (find_leads, termin „${p.term}“) u „Demo se pravi“ na Nikolinu proveru.`,
        intake_data: { scraped_at: new Date().toISOString(), scrape_method: 'find_leads', enrichment: { instagram_profile: { username: p.handle, followers: f, bio: p.r.bio,
          business_category: p.r.category, external_url: p.r.website } }, dm_demand: evidence } })
      console.log(error ? `  ERR ${p.handle} ${error.message}` : `  inserted ${p.handle}`)
    }
  }
}
