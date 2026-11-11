/**
 * verify_demo.mjs — the claims gate for demos. Nothing reaches "Email spreman" or an inbox unless this passes.
 *
 *   node verify_demo.mjs --all [--save]           every tenant in "Demo se pravi" / "Email spreman"
 *   node verify_demo.mjs --email <tenant> [--save]
 *   node verify_demo.mjs --all --offline          use the stored site copy if it is < 24 h old (no HTTP)
 *   node verify_demo.mjs --all --json
 *
 * Reads the seeded chats, CRM rows and tour cards, fetches the business's own pages live (HTTP only), and applies lib/demo-gate.mjs.
 * Writes nothing unless --save (then clients.onboarding_copy.gate). Exit code 1 if any demo fails. See lib/demo-gate.mjs for the rules.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipelineTenants } from './lib/pipeline-tenants.mjs'
import { verifyTenant, saveGate } from './lib/demo-gate-io.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)
const flag = (k) => args.includes(k)
const arg = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null }
const tenants = flag('--all') ? await pipelineTenants() : [arg('--email')].filter(Boolean)
if (!tenants.length) { console.error('usage: node verify_demo.mjs --all | --email <tenant> [--save] [--offline] [--json]'); process.exit(2) }

const out = []
for (const t of tenants) {
  const r = await verifyTenant(sb, t, { live: !flag('--offline') })
  if (r.error) { console.log(`ERR   ${t}: ${r.error}`); continue }
  if (flag('--save')) r.gate = await saveGate(sb, r.client, r)
  out.push({ tenant: t, ...r, client: undefined })
  if (flag('--json')) continue
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.company).slice(0, 36).padEnd(36)} ${r.failures.length} failure(s), ${r.warnings.length} warning(s)   site: ${r.corpus.from}, ${r.corpus.pages} pages, ${r.corpus.chars} chars`)
  // grouped by rule: the same defect on 60 filler threads is one finding with a count and examples
  const group = (list) => { const g = new Map(); for (const f of list) { const k = f.rule; if (!g.has(k)) g.set(k, { why: f.why, items: [] }); g.get(k).items.push(f) } return g }
  const show = (mark, list) => { for (const [rule, { why, items }] of group(list)) {
    const uniq = [...new Map(items.map((i) => [rule === 'number-not-on-site' ? i.text.split(' (')[0] : i.text, i])).values()]
    console.log(`      ${mark} [${rule}] x${items.length}${uniq.length !== items.length ? ` (${uniq.length} distinct)` : ''}: ${why}`)
    for (const i of uniq.slice(0, flag('--all-examples') ? 99 : 3)) console.log(`          ${i.where}: ${i.text}`)
  } }
  show('✗', r.failures)
  if (flag('--warnings') || args.includes('-v')) show('!', r.warnings)
}
if (flag('--json')) console.log(JSON.stringify(out, null, 2))
else {
  const bad = out.filter((r) => !r.ok).length
  console.log(`\n${out.length - bad} pass, ${bad} fail${flag('--save') ? ' (verdicts saved)' : ' (nothing saved; add --save)'}`)
}
process.exit(out.some((r) => !r.ok) ? 1 : 0)
