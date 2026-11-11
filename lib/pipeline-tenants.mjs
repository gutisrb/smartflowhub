// The demo tenants the pipeline is currently preparing for outreach (their login emails): every lead
// in the dashboard's "Demo se pravi" or "Email spreman" column (demo_building / email_ready) that has a
// demo tenant. 2026-11-05: built demos moved to "Email spreman" (Nikola: "move the leads that we built a
// demo for… put these 4 in their place"), so "Demo se pravi" now holds leads waiting for his check.
// Read from the DB, never typed by hand. The hand-kept list drifted (2026-10-28: it held 6 demos that
// were not in the column and missed 4 leads that were), so audits and owner reads checked the wrong set.
// One source for audit_demo_reality, owner_read, build_sheets, analyze_leads and collect_customer_voice.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const SMARTFLOW = '69acf7e9-557e-4ca3-85bd-a785ef39e351'

function env(key) {
  if (process.env[key]) return process.env[key]
  const file = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local')
  for (const l of readFileSync(file, 'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/)
    if (m && m[1].trim() === key) return m[2].trim()
  }
  throw new Error(`pipeline-tenants: ${key} missing`)
}

export async function pipelineTenants() {
  const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const { data, error } = await sb.from('contacts').select('demo_tenant_email')
    .eq('client_id', SMARTFLOW).in('pipeline_stage', ['demo_building', 'email_ready']).not('demo_tenant_email', 'is', null)
  if (error) throw new Error(`pipeline-tenants: ${error.message}`)
  return [...new Set(data.map(r => r.demo_tenant_email))]
}
