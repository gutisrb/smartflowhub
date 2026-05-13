/**
 * cleanup_stale_demos.mjs — Remove demo tenants older than 90 days with no conversion.
 *
 * Safe: only deletes tenants where the lead never replied and demo was built > 90 days ago.
 * Requires --confirm to actually delete (dry-run is the default).
 *
 * Usage:
 *   node cleanup_stale_demos.mjs             — dry-run (shows what would be deleted)
 *   node cleanup_stale_demos.mjs --confirm   — actually delete
 *   node cleanup_stale_demos.mjs --days 30   — use a different age threshold
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch { /* no .env.local */ }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351'

if (!SERVICE_KEY) { console.error('✗ SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const isConfirm = process.argv.includes('--confirm')
const daysIdx   = process.argv.indexOf('--days')
const AGE_DAYS  = daysIdx !== -1 ? parseInt(process.argv[daysIdx + 1]) : 90

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - AGE_DAYS)
  const cutoffIso = cutoff.toISOString()

  // Find stale demos: built > AGE_DAYS ago, lead never replied, has a demo_client_id
  const { data: staleLeads, error } = await sb
    .from('contacts')
    .select('id, company_name, email, demo_tenant_email, demo_client_id, demo_built_at')
    .eq('client_id', SMARTFLOW_ID)
    .not('demo_client_id', 'is', null)
    .lt('demo_built_at', cutoffIso)
    .is('replied_at', null)    // never replied → not a converted prospect

  if (error) { console.error(`✗ Fetch error: ${error.message}`); process.exit(1) }

  console.log(`\nSmartFlow Demo Cleanup`)
  console.log(`Threshold: ${AGE_DAYS} days (built before ${cutoff.toDateString()})`)
  console.log(`Stale demos found: ${(staleLeads || []).length}`)
  console.log(`Mode: ${isConfirm ? '🔴 LIVE DELETE' : '🟡 DRY RUN (pass --confirm to actually delete)'}\n`)

  if (!staleLeads || staleLeads.length === 0) {
    console.log('Nothing to clean up.')
    return
  }

  let deleted = 0, failed = 0

  for (const lead of staleLeads) {
    const clientId = lead.demo_client_id
    console.log(`  ${lead.company_name} — client ${clientId} (built ${lead.demo_built_at?.slice(0, 10)})`)

    if (!isConfirm) continue

    try {
      // Delete in dependency order (most specific → least)
      const steps = [
        { table: 'razgovori',     field: 'client_id',  id: clientId },
        { table: 'contacts',      field: 'client_id',  id: clientId },  // demo CRM contacts only
        { table: 'client_modules',field: 'client_id',  id: clientId },
        { table: 'clients',       field: 'id',         id: clientId },
      ]

      for (const { table, field, id } of steps) {
        // For contacts: only delete rows with client_id = demo_client_id (not the original lead)
        const { error: delErr } = await sb.from(table).delete().eq(field, id)
        if (delErr) throw new Error(`Delete from ${table}: ${delErr.message}`)
      }

      // Delete auth user (look up by demo_tenant_email)
      if (lead.demo_tenant_email) {
        const { data: users } = await sb.auth.admin.listUsers()
        const authUser = users?.users?.find(u => u.email === lead.demo_tenant_email)
        if (authUser) {
          const { error: authDelErr } = await sb.auth.admin.deleteUser(authUser.id)
          if (authDelErr) console.warn(`    ⚠ Auth delete failed: ${authDelErr.message}`)
          else console.log(`    Auth user deleted: ${lead.demo_tenant_email}`)
        }
      }

      // Clear demo fields on the original lead row
      const { error: clearErr } = await sb.from('contacts').update({
        demo_tenant_email:    null,
        demo_tenant_password: null,
        demo_tenant_url:      null,
        demo_built_at:        null,
        demo_client_id:       null,
      }).eq('id', lead.id)
      if (clearErr) throw new Error(`Clear demo fields: ${clearErr.message}`)

      console.log(`    ✓ Cleaned up`)
      deleted++
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`)
      failed++
    }
  }

  if (isConfirm) {
    console.log('\n═══════════════════════════════════════════════════════')
    console.log(`  Deleted: ${deleted}  |  Failed: ${failed}`)
  } else {
    console.log(`\n(No changes made — pass --confirm to delete these ${staleLeads.length} demo tenants)`)
  }
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1) })
