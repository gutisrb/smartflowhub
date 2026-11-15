#!/usr/bin/env node
// Regression check for lib/lead-judge.mjs against Nikola's own labels (his clicks and words). Run after any change to the judge prompt.
//   node eval_judge.mjs
import fs from 'fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
import { createClient } from '@supabase/supabase-js'
import { judgeAccounts } from './lib/lead-judge.mjs'
import { fetchSiteText } from './lib/lead-sanity.mjs'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const B = 'business'
const expected = {
  // approved or praised by Nikola
  dentist_mladenovic: B, vacasa_namestaj: B, 'beebike.rs': B, plus_exclusive: B, cvejanovic_dentalclinic: B, tandem_skok_beograd: B, aluroll_doo: B, kompakt_kontejneri: B, 'comfortino.kozna.obuca': B, furni_kashmere: B,
  'marco.dental.tourism.serbia': B, slwcontainer: B, 'luxor.furniture': B, jetsetmobilni: B, linea_milanovic: B, dentalux_dental: B, leonefashionsrbija: B, panteraunico: B, stefmarkshop: B,
  // removed or blocked by Nikola (not a business with its own offer)
  raicevicalex: 'personal', _stefanfarmer: 'personal', 'stefan.thecoach': 'personal', drmasic91: 'personal', dr_marko_jovasevic: 'personal', sknelly_official: 'personal', zelenolevifront: 'organization', balkanfunofficial: 'organization',
  // "dexyco is a corporation… like Walmart"; chains and marketplaces
  dexycokids: 'corporation', aksa_srbija: 'corporation', kompanijatrio: 'corporation', eplaneta_com: 'corporation', 'drmax.srbija': 'corporation',
}
const { data } = await sb.from('contacts').select('company_name,instagram_handle,niche,website,intake_data').eq('client_id', '69acf7e9-557e-4ca3-85bd-a785ef39e351').in('instagram_handle', Object.keys(expected))
const seen = new Set(), items = []
for (const r of data) { if (seen.has(r.instagram_handle)) continue; seen.add(r.instagram_handle); const ig = r.intake_data?.enrichment?.instagram_profile || {}
  items.push({ handle: r.instagram_handle, name: r.company_name, category: ig.business_category || r.niche || '', bio: ig.bio || '', site: (await fetchSiteText(r.website)).slice(0, 400) }) }
const res = await judgeAccounts(items)
let wrong = 0, wrongCut = 0, silentPass = 0, doubts = 0
for (const it of items) { const j = res.get(it.handle.toLowerCase()), exp = expected[it.handle]
  const doubt = !!j?.doubt
  if (doubt) doubts++
  const ok = j && (doubt || (exp === B ? j.kind === B : j.kind !== B)) // a doubt keeps the lead visible with a warning: acceptable either way
  if (!ok) { wrong++; if (exp === B) wrongCut++; else silentPass++ }
  if (!ok || process.argv.includes('--all')) console.log(ok ? '  ok ' : '  XX ', exp.padEnd(12), '->', (j?.kind || '(none)').padEnd(12), String(j?.confidence ?? '').padEnd(4), ('@' + it.handle).padEnd(30), '|', (j?.reason || '').slice(0, 70)) }
const byEngine = {}; for (const j of res.values()) byEngine[j.engine] = (byEngine[j.engine] || 0) + 1
console.log('engines used:', JSON.stringify(byEngine))
console.log(`judge: ${items.length - wrong} of ${items.length} acceptable | wrongly CUT (a lead he likes): ${wrongCut} | wrongly PASSED silently (a non-business): ${silentPass} | shown with a doubt flag: ${doubts}`)
process.exit(wrong ? 1 : 0)
