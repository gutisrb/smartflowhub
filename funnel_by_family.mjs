#!/usr/bin/env node
// Where does the bias enter? Counts leads per business type at every stage of the funnel (read-only, free). 2026-11-15, Nikola: "I keep seeing dentists, furniture."
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { ownDomain } from './lib/email-finder.mjs'
import { profileFit } from './lib/lead-profile.mjs'
import { isStrongMessageAd } from './lib/lead-fit.mjs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let all = [], from = 0
while (true) { const { data, error } = await sb.from('contacts').select('company_name,instagram_handle,instagram_followers,niche,pipeline_stage,email,website,izvor,created_at,intake_data').eq('client_id', '69acf7e9-557e-4ca3-85bd-a785ef39e351').range(from, from + 999); if (error || !data.length) break; all = all.concat(data); if (data.length < 1000) break; from += 1000 }
const FAM = [['dental/medical', /stomat|dental|dentist|ordinacij|klinik|hirurg|estetsk|medic|zubar/i], ['furniture', /namestaj|nameštaj|furniture|enterijer|interior|kuhinj|plakar|stolar|garnitur|krevet|lezaj|ležaj|stolic/i], ['prefab/windows/pergolas', /kontejner|montazn|montažn|tiny|pergol|tende|pvc|aluminij|stolarij|fasad|vikendic|zastakljiv/i],
  ['fashion/shoes/accessories', /fashion|odeca|odeća|obuc|obuć|haljin|cipel|clothing|butik|garderob|patike|nakit|torb|satov|naocar/i], ['beauty/cosmetics/hair', /kozmet|beauty|hair|kosa|frizer|nokti|lash|laser|cosmetic|sminka|šminka|parfem/i], ['kids/toys/baby', /bebi|beba|deca|decij|igracke|igračke|kids|toys/i], ['auto/bike/tech', /auto |moto|bike|bicikl|vozil|gume|mobiln|telefon|racunar|računar|elektron/i], ['food/drink/farm', /hrana|food|farm|ketering|torta|slatk|vino|vinar|catering|sok/i], ['home textile/decor', /posteljin|tekstil|zavese|tepih|dekor|decor/i], ['sport/fitness', /fitnes|fitness|sport|teretana|sprava/i]]
const famOf = (r) => { const bio = r.intake_data?.enrichment?.instagram_profile?.bio || ''; const t = [r.company_name, r.niche, bio, r.website, r.instagram_handle].join(' '); for (const [n, re] of FAM) if (re.test(t)) return n; return 'other/unknown' }
const okMail = (e) => !!e && !/@(email|website|example)\./.test(e)
const med = (r) => { const i = r.intake_data || {}, d = i.dm_demand || {}, a = i.audit || {}, fc = i.reach_fc || {}; return d.median_views ?? a.medViews ?? ((fc.reelsSeen ?? 0) >= 3 ? fc.medViews : null) }
const days = (r) => { const i = r.intake_data || {}, a = i.audit || {}; const d = Date.parse(a.ads?.since || String(i.ad_start_date || '').slice(0, 10)); return Number.isFinite(d) ? Math.round((Date.now() - d) / 864e5) : null }
const band = all.filter((r) => r.instagram_handle && (r.instagram_followers || 0) >= 15000 && (r.instagram_followers || 0) <= 200000)
const stages = [['S0 in band', () => true], ['S1 own site+email', (r) => okMail(r.email) && ownDomain(r.website)],
  ['S2 passes profile check', (r) => profileFit({ name: r.company_name, niche: r.niche, bio: r.intake_data?.enrichment?.instagram_profile?.bio, category: r.intake_data?.enrichment?.instagram_profile?.business_category, followers: r.instagram_followers, website: r.website }).pass],
  ['S3 reach measured', (r) => med(r) != null], ['S4 strong (>=20k or msg ad)', (r) => (med(r) ?? 0) >= 20000 || isStrongMessageAd({ ads: Number(r.intake_data?.active_ads_count || r.intake_data?.audit?.ads?.active || 0), days: days(r), cta: r.intake_data?.ad_cta })], ['SHOWN station 1', (r) => r.pipeline_stage === 'novi']]
let pool = band; const counts = []
for (const [name, f] of stages) { pool = pool.filter(f); const by = {}; for (const r of pool) { const k = famOf(r); by[k] = (by[k] || 0) + 1 } counts.push({ name, n: pool.length, by }) }
const fams = [...new Set(counts.flatMap((c) => Object.keys(c.by)))]
console.log('stage'.padEnd(28), 'total'.padStart(5), '|', 'dental/furn share'.padStart(18), '|', 'other families')
for (const c of counts) { const dm = (c.by['dental/medical'] || 0), fu = (c.by['furniture'] || 0) + (c.by['prefab/windows/pergolas'] || 0); console.log(c.name.padEnd(28), String(c.n).padStart(5), '|', `${dm}+${fu} = ${c.n ? Math.round(100 * (dm + fu) / c.n) : 0}%`.padStart(18), '|', fams.filter((f) => !['dental/medical', 'furniture', 'prefab/windows/pergolas'].includes(f)).map((f) => `${f.split('/')[0]} ${c.by[f] || 0}`).join(' · ')) }
// the reach of leads in the funnel that were measured: who got measured, and when did we find them
const meas = band.filter((r) => med(r) != null), unm = band.filter((r) => med(r) == null && okMail(r.email) && ownDomain(r.website))
const share = (rows) => { const n = rows.length || 1; const k = rows.filter((r) => ['dental/medical', 'furniture', 'prefab/windows/pergolas'].includes(famOf(r))).length; return `${k}/${rows.length} = ${Math.round(100 * k / n)}%` }
console.log('\ndental + furniture + prefab share: ALL band', share(band), '| MEASURED', share(meas), '| NOT measured but complete (site+email)', share(unm))
const src = {}; for (const r of meas) { const k = r.izvor || '?'; src[k] = (src[k] || 0) + 1 }
console.log('measured leads by where they came from:', JSON.stringify(src))
