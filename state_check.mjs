#!/usr/bin/env node
// One-screen state of the pipeline: Apify budget, and what each ready / approved lead still lacks before it can be sent. Read-only, no credits.
import fs from 'fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
import { createClient } from '@supabase/supabase-js'
import { pickApifyToken } from './lib/apify-key.mjs'

console.log('=== APIFY keys ===')
const key = await pickApifyToken(0.3, { quiet: false })
console.log(key ? 'usable: ' + key.label + ' (' + key.left.toFixed(2) + ' USD left)' : 'none usable yet')

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('contacts').select('company_name,instagram_handle,pipeline_stage,email,demo_tenant_url,demo_tenant_email,email_draft,approved_to_send,intake_data').eq('client_id', '69acf7e9-557e-4ca3-85bd-a785ef39e351').in('pipeline_stage', ['email_ready', 'demo_building', 'novi'])
const sheets = new Set(fs.readdirSync('sheets').map((f) => f.replace('.json', '')))
console.log('\n=== READY and APPROVED leads ===')
for (const r of data.filter((x) => x.pipeline_stage !== 'novi').sort((a, b) => a.pipeline_stage.localeCompare(b.pipeline_stage))) {
  const sheet = sheets.has(r.demo_tenant_email || '~') || sheets.has(r.email || '~')
  console.log(r.pipeline_stage.padEnd(14), (r.instagram_handle || '').padEnd(28), 'demo', r.demo_tenant_url ? 'Y' : '-', 'sheet', sheet ? 'Y' : '-', 'draft', r.email_draft ? 'Y' : '-', 'approved_to_send', r.approved_to_send ? 'Y' : '-', 'mail', r.email || '-')
}
console.log('\nStation 1 (novi, undecided):', data.filter((x) => x.pipeline_stage === 'novi').length)
