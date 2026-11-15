#!/usr/bin/env node
/**
 * find_websites.mjs — does a no-website lead REALLY have no website? Only for leads with real evidence (tiers A/B of audit_nosite.json), one plain Firecrawl
 * search each (2 credits), candidate pages verified with FREE fetches (a site counts only if its page carries the lead's Instagram handle or a phone number
 * from its bio). Hard cap on credits; a found site is saved with its evidence, an email is looked for with the free layers only.
 *
 *   node audit_nosite.mjs                  (writes audit_nosite.json first)
 *   node find_websites.mjs [--tiers A,B] [--max-credits 40] [--dry]
 */
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { findWebsite, findEmail, siteAlive } from './lib/email-finder.mjs'
import { fcSpent, fcCap } from './lib/fc-budget.mjs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
process.env.FIRECRAWL_MAX_CREDITS = String(arg('--max-credits', 40))
const TIERS = arg('--tiers', 'A,B').split(','), DRY = process.argv.includes('--dry')
const TODAY = new Date().toISOString().slice(0, 10)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const rows = JSON.parse(fs.readFileSync('audit_nosite.json', 'utf8')).filter((r) => r.out === 'business' && TIERS.includes(r.tier) && !r.doubt)
console.log(`${rows.length} leads with real evidence (tiers ${TIERS.join('/')}), cap ${fcCap()} credits, 2 per search\n`)
const bal = async () => (await (await fetch('https://api.firecrawl.dev/v2/team/credit-usage', { headers: { authorization: `Bearer ${env.FIRECRAWL_API_KEY}` } })).json()).data?.remainingCredits
const before = await bal()
let found = 0
const results = []
for (const row of rows) {
  const { data } = await sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,email,intake_data').eq('client_id', '69acf7e9-557e-4ca3-85bd-a785ef39e351').eq('instagram_handle', row.handle).limit(1)
  const lead = data?.[0]; if (!lead) continue
  if (fcSpent() + 2 > fcCap()) { console.log('  stopping: budget reached'); break }
  const site = await findWebsite(lead)
  const alive = site ? await siteAlive(site) : false
  console.log(`  ${site ? (alive ? 'FOUND ' : 'dead  ') : 'none  '} @${row.handle.padEnd(26)} ${site || '(no page carried its IG handle or phone)'}`)
  results.push({ handle: row.handle, site, alive })
  if (!site || !alive || DRY) continue
  found++
  const f = await findEmail({ ...lead, website: site }, { firecrawlKey: '', hunter: false, apifyToken: null }) // free layers only
  const patch = { website: site, intake_data: { ...(lead.intake_data || {}), website_source: { at: TODAY, via: 'find_websites.mjs (search + free page check)' } } }
  if (f.email && !lead.email) { patch.email = f.email; patch.status = 'enriched'; patch.intake_data.email_source = { at: TODAY, source: f.source, evidence: f.evidence } }
  await sb.from('contacts').update(patch).eq('id', lead.id)
  console.log(`         saved${f.email ? ' + email ' + f.email : ' (no email on the free layers)'}`)
}
await new Promise((r) => setTimeout(r, 20000))
const after = await bal()
console.log(`\nsearches run: ${results.length} · websites found and alive: ${found} · credits assumed ${fcSpent()} · balance endpoint ${before} -> ${after} (may lag)`)
