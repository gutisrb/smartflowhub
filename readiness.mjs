/**
 * readiness.mjs — is every demo in the pipeline REALLY ready to send? One table, one definition (Nikola, 2026-11-11: "100% done and ready").
 *
 *   node readiness.mjs [--json] [--verify-emails]
 *
 * Columns (all must be ✓ for a row to be READY):
 *   gate    claims gate verdict stored and ok          sheet   hand sheet with hero + e1 block (sheets/<tenant>.json)
 *   voice   ≥3 real customer questions stored          e1      E1 draft stored in contacts.email_draft and the copy lint is clean
 *   art     opening wallpaper file exists + linked     login   the demo login (email + password) really signs in
 *   mail    address well-formed, not a placeholder     stage   pipeline_stage = email_ready
 * --verify-emails also asks Hunter whether the mailbox exists (1 verification credit each; result stored in intake_data.email_check).
 * Never sends anything.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { redFlags, bodyWords } from './lib/copy-red-flags.mjs'
import { extractEmails } from './lib/email-finder.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const { data: leads } = await sb.from('contacts').select('id,company_name,email,pipeline_stage,email_draft,demo_tenant_email,demo_tenant_password,intake_data,approved_to_send,email_1_poslat').eq('client_id', SF).in('pipeline_stage', ['demo_building', 'email_ready']).not('demo_tenant_email', 'is', null)
const rows = []
for (const l of leads || []) {
  const t = l.demo_tenant_email
  const { data: c } = await sb.from('clients').select('id,name,onboarding_copy').eq('email', t).single()
  const oc = c?.onboarding_copy || {}
  const sheetPath = resolve(__dirname, 'sheets', `${t}.json`)
  const sheet = existsSync(sheetPath) ? JSON.parse(readFileSync(sheetPath, 'utf8')) : null
  const draft = l.email_draft || ''
  const subj = (draft.match(/^Subject:\s*(.*)$/mi) || [])[1] || ''
  const lint = draft ? redFlags({ subject: subj, body: draft }) : null
  const mailOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(l.email || '') && extractEmails(l.email || '').length === 1
  let login = false
  // sign-ins are rate limited when several readers run at once: retry, and only for demos that pass the gate
  if (l.demo_tenant_password && (l.pipeline_stage === 'email_ready' || oc.gate?.ok)) {
    for (let k = 0; k < 4 && !login; k++) {
      const r = await anon().auth.signInWithPassword({ email: t, password: l.demo_tenant_password })
      login = !r.error
      if (!login) { if (r.error?.status === 400 && /invalid login/i.test(r.error.message)) break; await new Promise((res) => setTimeout(res, 1500 * (k + 1))) }
    }
  }
  let check = l.intake_data?.email_check || null
  if (process.argv.includes('--verify-emails') && mailOk && process.env.HUNTER_API_KEY && !check && (l.pipeline_stage === 'email_ready' || oc.gate?.ok)) {
    try { const r = await (await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(l.email)}&api_key=${process.env.HUNTER_API_KEY}`)).json(); check = { status: r.data?.status, at: new Date().toISOString() }
      await sb.from('contacts').update({ intake_data: { ...(l.intake_data || {}), email_check: check } }).eq('id', l.id) } catch { /* unverified */ }
  }
  const cell = {
    gate: !!oc.gate?.ok, sheet: !!(sheet?.hero?.msgs?.length && sheet?.e1), voice: (oc.customer_voice?.questions || []).length >= 3,
    e1: !!draft && !lint?.flags?.length, art: !!oc.intro_art && existsSync(resolve(__dirname, 'public', oc.intro_art.replace(/^\//, ''))),
    login, mail: mailOk && check?.status !== 'invalid', stage: l.pipeline_stage === 'email_ready',
  }
  rows.push({ name: l.company_name, tenant: t, email: l.email, check: check?.status || null, words: draft ? bodyWords(draft) : 0, flags: lint?.flags || [], ...cell, ready: Object.values(cell).every(Boolean) })
}
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1))
else {
  const cols = ['gate', 'sheet', 'voice', 'e1', 'art', 'login', 'mail', 'stage']
  console.log('lead'.padEnd(34) + cols.map((c) => c.padEnd(6)).join('') + 'ready  mail-check')
  for (const r of rows.sort((a, b) => Number(b.ready) - Number(a.ready) || a.name.localeCompare(b.name))) console.log(String(r.name).slice(0, 32).padEnd(34) + cols.map((c) => (r[c] ? '✓' : '✗').padEnd(6)).join('') + (r.ready ? 'READY ' : '      ') + (r.check || '') + (r.flags.length ? `  lint: ${r.flags.join('; ').slice(0, 80)}` : ''))
  console.log(`\n${rows.filter((r) => r.ready).length}/${rows.length} ready`)
}
