/**
 * build_demo_tenant.mjs — Auto-provision a SmartFlow demo tenant for a cold lead.
 *
 * Pipeline per lead:
 *   1. Idempotency check (skip if demo_built_at set, unless --force)
 *   2. Firecrawl scrape lead website → markdown
 *   3. gpt-4o-mini → generate realistic demo data (CRM contacts + conversations)
 *   4. Provision Supabase tenant (auth user + client record + modules)
 *   5. Seed CRM contacts + razgovori (social inbox)
 *   6. Write back demo_tenant_* to original contacts row
 *
 * Usage:
 *   node build_demo_tenant.mjs --lead-id <uuid>
 *   node build_demo_tenant.mjs --all [--limit 5]
 *   node build_demo_tenant.mjs --dry-run
 *   node build_demo_tenant.mjs --force
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ────────────────────────────────────────────────────────────
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

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY    = process.env.OPENAI_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const SMARTFLOW_ID  = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const APP_URL       = 'https://app.smartflow.rs'
const OPENAI_MODEL  = 'gpt-4o-mini'

if (!OPENAI_KEY)  { console.error('✗ OPENAI_API_KEY not set in .env.local'); process.exit(1) }
if (!SERVICE_KEY) { console.error('✗ SUPABASE_SERVICE_ROLE_KEY not set in .env.local'); process.exit(1) }

const openai = new OpenAI({ apiKey: OPENAI_KEY })

// ── CLI args ───────────────────────────────────────────────────────────────────
const isDryRun  = process.argv.includes('--dry-run')
const isForce   = process.argv.includes('--force')
const isAll     = process.argv.includes('--all')
const leadIdIdx = process.argv.indexOf('--lead-id')
const LEAD_ID   = leadIdIdx !== -1 ? process.argv[leadIdIdx + 1] : null
const limitIdx  = process.argv.indexOf('--limit')
const LIMIT     = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0

if (!LEAD_ID && !isAll) {
  console.error('Usage: node build_demo_tenant.mjs --lead-id <uuid> | --all [--limit N] [--dry-run] [--force]')
  process.exit(1)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Password generator ─────────────────────────────────────────────────────────
function genPassword() {
  // Memorable: "Sf" prefix + 10 unambiguous alphanumeric chars
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = 'Sf'
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

// ── Timestamp helpers ──────────────────────────────────────────────────────────
function hoursAgo(h, m = 0) {
  const d = new Date()
  d.setHours(d.getHours() - h, d.getMinutes() - m, 0, 0)
  return d.toISOString()
}
function daysAgo(days, hour = 10, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

// ── Firecrawl scrape ───────────────────────────────────────────────────────────
async function scrapeWebsite(websiteUrl) {
  if (!FIRECRAWL_KEY || !websiteUrl) return ''

  let base
  try {
    base = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    new URL(base) // validate
  } catch { return '' }

  const domain = new URL(base).hostname.replace(/^www\./, '')
  // Scrape homepage + one product/service page (2 max for cost control)
  const candidates = [base, `https://${domain}/usluge`, `https://${domain}/products`, `https://${domain}/proizvodi`]

  const parts = []
  for (const url of candidates.slice(0, 2)) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', url, '--format', 'markdown',
      ], {
        timeout: 25000,
        env: { ...process.env, FIRECRAWL_API_KEY: FIRECRAWL_KEY },
      })
      if (stdout?.trim()) parts.push(stdout.trim())
    } catch { /* URL unreachable or timeout — continue */ }
  }

  // Trim to ~5000 chars so we don't bloat LLM context
  return parts.join('\n\n---\n\n').slice(0, 5000)
}

// ── LLM: generate demo data ────────────────────────────────────────────────────
const DEMO_DATA_PROMPT = `You are a data generator for SmartFlow AI demo accounts. Given a Serbian business's info, generate realistic Serbian customer CRM data and social inbox conversations for a demo dashboard.

Goal: when a prospect logs into their demo dashboard, they see conversations that look like their real customers asking about their actual products/services.

Return ONLY raw JSON (no markdown, no \`\`\`json wrapper):
{
  "brand_name": "Clean display name for this business",
  "crm_contacts": [
    {
      "name": "Serbian full name",
      "niche": "specific product/service they asked about",
      "status": "Upit|Zainteresovan|Poručio|Isporučeno|Reklamacija",
      "izvor": "Instagram DM|Facebook poruka|Website Chat",
      "comment": "What they asked or did, in natural Serbian (1-2 sentences)"
    }
  ],
  "conversations": [
    {
      "id": "conv_1",
      "platform": "instagram|facebook|website",
      "customer_name": "Serbian full name",
      "messages": [
        { "role": "user", "text": "Customer question in Serbian" },
        { "role": "assistant", "text": "AI response in Serbian, referencing real products/prices" }
      ]
    }
  ]
}

Rules:
- ALL text in Serbian (Latin script)
- Names: common Serbian first + last names (Jovana Filipovic, Marko Petrovic, etc.)
- CRM contacts: 8-10 entries, realistic status mix (~30% Upit, ~25% Zainteresovan, ~25% Poručio/Isporučeno, ~20% Reklamacija)
- Conversations: 4-5 entries, 4-8 messages each, mix of platforms (instagram/facebook/website)
- Products/services MUST reference the actual business — use real product names, prices, specifics from the website content if available
- The LAST message in exactly ONE conversation must be: { "role": "system", "text": "[HUMAN_NEEDED]" } to demo the human-escalation feature
- AI responses are natural Serbian business communication — specific, helpful, referencing real products
- If website content is sparse, generate realistic data for this industry/niche`

async function generateDemoData(companyName, niche, websiteContent) {
  const userMsg = [
    `Company: ${companyName}`,
    `Industry/niche: ${niche || 'general services'}`,
    websiteContent
      ? `Website content (may be partial):\n${websiteContent}`
      : '(no website content — generate based on company name and industry)',
  ].join('\n\n')

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: DEMO_DATA_PROMPT },
      { role: 'user',   content: userMsg },
    ],
  })

  const raw = completion.choices[0].message.content || '{}'
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`LLM returned non-JSON: ${raw.slice(0, 300)}`)
  }

  if (!Array.isArray(data.crm_contacts) || !Array.isArray(data.conversations)) {
    throw new Error(`LLM missing required fields: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data
}

// ── Supabase tenant provisioning ───────────────────────────────────────────────
async function provisionTenant(sb, lead, brandName, password) {
  const email = lead.email
  let authEmail = email

  // Step 1: Create auth user
  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.message.toLowerCase().includes('already') || authErr.code === 'email_exists') {
      // Email already registered — use a suffixed alias so the demo still works
      const hash = randomBytes(3).toString('hex')
      authEmail = email.replace('@', `+demo${hash}@`)
      const { error: retryErr } = await sb.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
      })
      if (retryErr) throw new Error(`Auth user error (suffix): ${retryErr.message}`)
      console.log(`  Auth: ${authEmail} (suffixed — original was already registered)`)
    } else {
      throw new Error(`Auth user error: ${authErr.message}`)
    }
  } else {
    console.log(`  Auth: ${authEmail} (${authData?.user?.id || 'created'})`)
  }

  // Step 2: Get or create client record
  const { data: existing } = await sb
    .from('clients')
    .select('id')
    .eq('email', authEmail)
    .maybeSingle()

  let clientId
  if (existing) {
    clientId = existing.id
    console.log(`  Client: ${clientId} (already exists)`)
  } else {
    const { data: newClient, error: clientErr } = await sb
      .from('clients')
      .insert({ name: brandName || lead.company_name, email: authEmail })
      .select('id')
      .single()
    if (clientErr) throw new Error(`Client insert: ${clientErr.message}`)
    clientId = newClient.id
    console.log(`  Client: ${clientId} (created)`)
  }

  // Step 3: Upsert modules — social-chatbot, business-crm, analytics
  const modules = [
    {
      client_id: clientId, module_key: 'social-chatbot', is_enabled: true,
      display_name: 'AI Inbox', sort_order: 1,
      settings: { platforms: ['instagram', 'facebook', 'website'] },
    },
    {
      client_id: clientId, module_key: 'business-crm', is_enabled: true,
      display_name: 'Kupci', sort_order: 2,
      settings: { statuses: ['Upit', 'Zainteresovan', 'Poručio', 'Isporučeno', 'Reklamacija'], showAgencyMetrics: false },
    },
    {
      client_id: clientId, module_key: 'analytics', is_enabled: true,
      display_name: 'Analitika', sort_order: 3, settings: null,
    },
  ]
  const { error: modErr } = await sb
    .from('client_modules')
    .upsert(modules, { onConflict: 'client_id,module_key' })
  if (modErr) throw new Error(`Modules upsert: ${modErr.message}`)
  console.log(`  Modules: ${modules.length} upserted (AI Inbox, Kupci, Analitika)`)

  return { clientId, authEmail }
}

// ── Seed CRM contacts ──────────────────────────────────────────────────────────
const VALID_STATUSES = new Set(['Upit', 'Zainteresovan', 'Poručio', 'Isporučeno', 'Reklamacija'])
const VALID_IZVORI   = new Set(['Instagram DM', 'Facebook poruka', 'Website Chat'])

async function seedCrmContacts(sb, clientId, crmContacts) {
  const rows = crmContacts.map((c, i) => ({
    client_id:  clientId,
    name:       c.name || 'Kupac',
    email:      null,
    comment:    c.comment || '',
    niche:      c.niche || '',
    status:     VALID_STATUSES.has(c.status) ? c.status : 'Upit',
    izvor:      VALID_IZVORI.has(c.izvor) ? c.izvor : 'Instagram DM',
    created_at: daysAgo(i + 1, 8 + (i % 9), (i * 13) % 60),
  }))

  const { error } = await sb.from('contacts').insert(rows)
  if (error) throw new Error(`CRM contacts insert: ${error.message}`)
  console.log(`  CRM: ${rows.length} contacts inserted`)
}

// ── Seed razgovori ─────────────────────────────────────────────────────────────
const FEMALE_NAMES = new Set(['jovana', 'milica', 'ana', 'nina', 'iva', 'tamara', 'jelena', 'marija', 'maja', 'aleksandra', 'katarina', 'tijana', 'dragana', 'marina', 'bojana', 'jasmina'])
const PIC_MALE   = ['https://randomuser.me/api/portraits/men/32.jpg', 'https://randomuser.me/api/portraits/men/47.jpg', 'https://randomuser.me/api/portraits/men/67.jpg', 'https://randomuser.me/api/portraits/men/77.jpg', 'https://randomuser.me/api/portraits/men/55.jpg']
const PIC_FEMALE = ['https://randomuser.me/api/portraits/women/44.jpg', 'https://randomuser.me/api/portraits/women/23.jpg', 'https://randomuser.me/api/portraits/women/61.jpg', 'https://randomuser.me/api/portraits/women/5.jpg', 'https://randomuser.me/api/portraits/women/26.jpg']

function pickPic(name, idx) {
  const firstName = (name || '').split(' ')[0].toLowerCase()
  const pics = FEMALE_NAMES.has(firstName) ? PIC_FEMALE : PIC_MALE
  return pics[idx % pics.length]
}

const VALID_PLATFORMS = new Set(['instagram', 'facebook', 'website'])

async function seedRazgovori(sb, clientId, conversations) {
  const msgs = []

  conversations.forEach((conv, convIdx) => {
    const convId  = `demo_${clientId.slice(0, 8)}_${conv.id || convIdx + 1}`
    const pic     = pickPic(conv.customer_name, convIdx)
    const baseH   = (convIdx + 1) * 9 + (convIdx % 3) * 7  // stagger across time
    const platform = VALID_PLATFORMS.has(conv.platform) ? conv.platform : 'instagram'

    ;(conv.messages || []).forEach((msg, msgIdx) => {
      msgs.push({
        id_razgovora: convId,
        role:         msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user',
        message:      msg.text || '',
        created_at:   hoursAgo(baseH - msgIdx * 0.3),
        platform,
        client_id:    clientId,
        metadata:     { name: conv.customer_name, profile_pic: pic },
      })
    })
  })

  const BATCH = 50
  for (let i = 0; i < msgs.length; i += BATCH) {
    const { error } = await sb.from('razgovori').insert(msgs.slice(i, i + BATCH))
    if (error) throw new Error(`Razgovori batch: ${error.message}`)
  }
  console.log(`  Inbox: ${msgs.length} messages across ${conversations.length} conversations`)
}

// ── Build demo for one lead ────────────────────────────────────────────────────
async function buildDemoForLead(sb, lead) {
  const name = lead.company_name || '(no name)'
  console.log(`\n┌─ ${name}`)
  console.log(`│  ID:      ${lead.id}`)
  console.log(`│  Email:   ${lead.email}`)
  console.log(`│  Website: ${lead.website || '(none)'}`)

  if (lead.demo_built_at && !isForce) {
    console.log(`│  ↷ Already built (${lead.demo_built_at}) — skipping (use --force to rebuild)`)
    console.log(`└─────`)
    return { skipped: true }
  }

  if (isDryRun) {
    console.log(`│  ✓ [DRY RUN — would scrape, generate, provision, seed]`)
    console.log(`└─────`)
    return { dryRun: true }
  }

  // Step 1: Firecrawl
  console.log(`│  [1/5] Scraping website...`)
  let websiteContent = ''
  try {
    websiteContent = await scrapeWebsite(lead.website)
    console.log(`│         ${websiteContent.length} chars scraped`)
  } catch (err) {
    console.log(`│         ⚠ Scrape failed: ${err.message} — continuing without`)
  }

  // Step 2: LLM generation
  console.log(`│  [2/5] Generating demo data (gpt-4o-mini)...`)
  const demoData = await generateDemoData(
    lead.company_name || name,
    lead.niche || '',
    websiteContent,
  )
  console.log(`│         ${demoData.crm_contacts?.length} CRM contacts, ${demoData.conversations?.length} conversations`)

  // Step 3: Provision tenant
  console.log(`│  [3/5] Provisioning Supabase tenant...`)
  const password = genPassword()
  const { clientId, authEmail } = await provisionTenant(sb, lead, demoData.brand_name, password)

  // Step 4: Seed data
  console.log(`│  [4/5] Seeding demo data...`)
  await seedCrmContacts(sb, clientId, demoData.crm_contacts || [])
  await seedRazgovori(sb, clientId, demoData.conversations || [])

  // Step 5: Writeback
  console.log(`│  [5/5] Writing back to contacts row...`)
  const { error: wbErr } = await sb.from('contacts').update({
    demo_tenant_email:    authEmail,
    demo_tenant_password: password,
    demo_tenant_url:      APP_URL,
    demo_built_at:        new Date().toISOString(),
    demo_client_id:       clientId,
  }).eq('id', lead.id)
  if (wbErr) throw new Error(`Writeback failed: ${wbErr.message}`)

  console.log(`│`)
  console.log(`│  ✅ Done!`)
  console.log(`│  Login URL: ${APP_URL}`)
  console.log(`│  Email:     ${authEmail}`)
  console.log(`└─ Password:  ${password}`)

  return { clientId, authEmail, password }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let leads = []

  if (LEAD_ID) {
    const { data, error } = await sb
      .from('contacts')
      .select('id, company_name, email, website, niche, demo_built_at')
      .eq('id', LEAD_ID)
      .single()
    if (error) { console.error(`✗ Lead not found: ${error.message}`); process.exit(1) }
    leads = [data]
  } else {
    // --all: enriched leads with email + website, no demo yet
    // Only target leads we'd actually send to (enriched / No Draft / Kontaktiran)
    let q = sb
      .from('contacts')
      .select('id, company_name, email, website, niche, demo_built_at, instagram_followers')
      .eq('client_id', SMARTFLOW_ID)
      .in('status', ['enriched', 'No Draft', 'Kontaktiran'])
      .not('email', 'is', null)
      .not('website', 'is', null)
      .order('instagram_followers', { ascending: false })

    if (!isForce) q = q.is('demo_built_at', null)
    if (LIMIT > 0) q = q.limit(LIMIT)

    const { data, error } = await q
    if (error) { console.error(`✗ Fetch error: ${error.message}`); process.exit(1) }
    leads = data || []
  }

  const date = new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
  console.log(`\nSmartFlow Demo Builder — ${date}`)
  console.log(`Leads: ${leads.length}${isDryRun ? ' [DRY RUN]' : ''}${isForce ? ' [FORCE]' : ''}`)
  console.log(`OpenAI: ${OPENAI_MODEL}  |  Firecrawl: ${FIRECRAWL_KEY ? 'available' : 'NOT SET'}`)

  if (leads.length === 0) {
    console.log('\nNo leads to process. (Use --all --force to reprocess existing demos.)')
    return
  }

  let built = 0, skipped = 0, failed = 0

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    try {
      const result = await buildDemoForLead(sb, lead)
      if (result.skipped) skipped++
      else if (!result.dryRun) built++
    } catch (err) {
      console.error(`\n✗ FAILED [${lead.company_name}]: ${err.message}`)
      failed++
    }

    if (i < leads.length - 1 && !isDryRun) await sleep(1500)
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`  Built: ${built}  |  Skipped: ${skipped}  |  Failed: ${failed}`)
  if (built > 0) {
    console.log(`\nNext: node generate_drafts.mjs --mode initial`)
    console.log(`      node send_outreach.mjs --dry-run`)
  }
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1) })
