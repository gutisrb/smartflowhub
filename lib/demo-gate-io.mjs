// Loads what lib/demo-gate.mjs needs for one demo tenant and stores the verdict. The site is fetched LIVE by default (HTTP only, no
// model, no paid API), so the gate is also the freshness check: a price that changed since the demo was built fails here, before a send.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { fetchSite } from './site-evidence.mjs'
import { checkDemo } from './demo-gate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS_DIR = resolve(ROOT, 'corpus')
const fileFor = (tenant) => resolve(CORPUS_DIR, `${String(tenant).replace(/[^a-z0-9@._+-]/gi, '_')}.json`)

async function page(sb, table, cid, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from(table).select(cols).eq('client_id', cid).range(from, from + 999)
    out.push(...(data || [])); if (!data || data.length < 1000) break
  }
  return out
}

/** The business's own pages: fetched now, else the stored copy if it is younger than maxAgeH (and then flagged). */
export async function loadCorpus(tenant, website, { live = true, maxAgeH = 24 } = {}) {
  const f = fileFor(tenant)
  const stored = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
  const ageH = stored ? (Date.now() - new Date(stored.fetched_at).getTime()) / 3.6e6 : Infinity
  if (!live && stored && ageH <= maxAgeH) return { text: stored.text, fetched_at: stored.fetched_at, from: 'stored', pages: stored.pages?.length ?? 0 }
  if (website) {
    const site = await fetchSite(website, { maxPages: 12 })
    if (site.corpus && site.corpus.length >= 500) {
      mkdirSync(CORPUS_DIR, { recursive: true })
      const rec = { website, fetched_at: new Date().toISOString(), pages: site.pages.map((p) => p.url), text: site.corpus }
      writeFileSync(f, JSON.stringify(rec))
      return { text: rec.text, fetched_at: rec.fetched_at, from: 'live', pages: rec.pages.length }
    }
  }
  if (stored) return { text: stored.text, fetched_at: stored.fetched_at, from: `stored (${Math.round(ageH)}h old, live fetch failed)`, pages: stored.pages?.length ?? 0 }
  return { text: '', fetched_at: null, from: 'none', pages: 0 }
}

export async function verifyTenant(sb, tenantEmail, opts = {}) {
  const { data: client } = await sb.from('clients').select('id,name,email,demo_niche,onboarding_copy').eq('email', tenantEmail).single()
  if (!client) return { error: `no client for ${tenantEmail}` }
  const { data: contact } = await sb.from('contacts').select('website,company_name').eq('demo_tenant_email', tenantEmail).limit(1).maybeSingle()
  const oc = client.onboarding_copy || {}
  const [rows, crm, catalog] = await Promise.all([
    page(sb, 'razgovori', client.id, 'id_razgovora,role,message,created_at'),
    page(sb, 'demo_crm', client.id, 'id_razgovora,status,razlog,komentar'),
    page(sb, 'services_catalog', client.id, 'name,price_min,price_max'),
  ])
  rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const corpus = await loadCorpus(tenantEmail, contact?.website || oc.business_sheet?.pages?.[0] || null, opts)
  const voice = oc.customer_voice || {}
  const sheet = oc.business_sheet || {}
  const result = checkDemo({
    threads: rows.map((r) => ({ id: r.id_razgovora, role: r.role, message: r.message })),
    crm, flows: sheet.flows, niche: client.demo_niche, model: oc.sales_model,
    corpus: corpus.text,
    captions: (voice.posts || []).map((p) => p?.caption || p?.text || '').filter(Boolean),
    otherSources: [
      catalog.map((c) => `${c.name} ${c.price_min ?? ''} ${c.price_max ?? ''}`).join('\n'),
      JSON.stringify(oc.offer_terms || {}), JSON.stringify(sheet.offers || []), JSON.stringify(sheet.booking || {}), JSON.stringify(sheet.shipping || {}),
      JSON.stringify(oc.sales_strategy || {}),
    ],
    questions: voice.questions || [],
    statusLabels: sheet.status_labels || {},
    heroOwn: !!(sheet.hero?.intervention || sheet.hero?.complaint),
  })
  return { client, company: contact?.company_name || client.name, website: contact?.website, corpus: { from: corpus.from, fetched_at: corpus.fetched_at, pages: corpus.pages, chars: corpus.text.length }, ...result }
}

/** Stored on the tenant so promote_email_ready and send_outreach can refuse a demo that did not pass. */
export async function saveGate(sb, client, r) {
  const { data: fresh } = await sb.from('clients').select('onboarding_copy').eq('id', client.id).single()
  const gate = { ok: r.ok, at: new Date().toISOString(), hash: r.hash, failures: r.failures.length, warnings: r.warnings.length, corpus_at: r.corpus?.fetched_at ?? null }
  await sb.from('clients').update({ onboarding_copy: { ...(fresh?.onboarding_copy || {}), gate } }).eq('id', client.id)
  return gate
}

/** For the sender and the promoter: did this tenant pass, recently, on exactly the content it has now? */
export function gateIsCurrent(gate, currentHash, maxAgeH = 24) {
  if (!gate?.ok) return { ok: false, why: gate ? `gate failed (${gate.failures} failure(s))` : 'gate never ran: node verify_demo.mjs --email <tenant> --save' }
  const ageH = (Date.now() - new Date(gate.at).getTime()) / 3.6e6
  if (ageH > maxAgeH) return { ok: false, why: `gate is ${Math.round(ageH)}h old (max ${maxAgeH}h): run verify_demo.mjs again` }
  if (currentHash && gate.hash !== currentHash) return { ok: false, why: 'demo content changed since the gate passed' }
  return { ok: true }
}
