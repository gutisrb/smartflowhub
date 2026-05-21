/**
 * build_demo_tenant.mjs — Niche-Aware Demo Tenant Provisioning v2
 *
 * For each lead: Firecrawl → 4-pass LLM → Supabase provision → seed all 4 tables
 *
 * Usage:
 *   node build_demo_tenant.mjs --lead-id <uuid>
 *   node build_demo_tenant.mjs --all [--limit N]
 *   node build_demo_tenant.mjs --dry-run
 *   node build_demo_tenant.mjs --force
 *   node build_demo_tenant.mjs --reseed-only --lead-id <uuid>   # skip auth/client creation
 *   node build_demo_tenant.mjs --reseed-only --all
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

// ── Load niche config ──────────────────────────────────────────────────────────
const NICHE_CONFIGS = JSON.parse(readFileSync(resolve(__dirname, 'lib/niche-config.json'), 'utf8'))

const NICHE_KEYWORDS = [
  { pattern: /dental|stomato|zub|ortodon|implant/i,                               key: 'dental' },
  { pattern: /klinik|medic|hospital|ordinacij|doktor|lekar(?!s)/i,                key: 'medical' },
  { pattern: /fitnes|teretana|gym|sport(?!s?\s*shop)|trening|pilates|yoga/i,      key: 'fitness' },
  // ecommerce/shop BEFORE beauty — "Beauty Store" should hit ecommerce, not beauty
  { pattern: /prodavnic|webshop|online\s*shop|e.?commerc|online\s*prodaj|web\s*shop|shop\b|store\b|dodaj u korpu|add to cart|košaric|naruči|poruči online/i, key: 'ecommerce' },
  { pattern: /estetik|lepot|kozmetik|beauty|nokat|trepavic|frizeri|salon|studio|tretman/i, key: 'beauty' },
  { pattern: /klinika_wellness|wellness\s*centar|spa\s*centar/i,                  key: 'beauty' },
  { pattern: /nekretnin|real.?estat|apartman|stan|agencija za nekret/i,           key: 'real-estate' },
  { pattern: /restoran|kafana|pica|burger|catering|ugostiteljst/i,                key: 'food' },
  { pattern: /turizm|putovanj|travel|hotel|smestaj|odmor|letovanj/i,              key: 'travel' },
  { pattern: /namestaj|nameštaj|enterijer|interior|sofa|garnitur|krevet/i,        key: 'furniture' },
  { pattern: /moda|fashion|odjeć|odeca|majic|pantalo|haljin|odeća/i,              key: 'fashion' },
  { pattern: /auto|vozil|automobil|motocikl|polovn/i,                             key: 'auto' },
  { pattern: /konsalting|konsultant|agencij|b2b|uslug|servis/i,                   key: 'services' },
]

const KNOWN_NICHE_KEYS = new Set(['dental','medical','fitness','beauty','real-estate','food','travel','furniture','fashion','auto','ecommerce','services','generic'])

function inferNicheKey(rawNiche, websiteSummary = '', companyName = '') {
  const trimmed = (rawNiche || '').trim().toLowerCase()
  if (KNOWN_NICHE_KEYS.has(trimmed)) return trimmed
  const text = `${rawNiche || ''} ${companyName || ''} ${websiteSummary || ''}`.toLowerCase()
  if (!text.trim()) return 'generic'
  for (const { pattern, key } of NICHE_KEYWORDS) {
    if (pattern.test(text)) return key
  }
  return 'generic'
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const isDryRun    = process.argv.includes('--dry-run')
const isForce     = process.argv.includes('--force')
const isAll       = process.argv.includes('--all')
const isReseedOnly = process.argv.includes('--reseed-only')
const leadIdIdx   = process.argv.indexOf('--lead-id')
const LEAD_ID     = leadIdIdx !== -1 ? process.argv[leadIdIdx + 1] : null
const limitIdx    = process.argv.indexOf('--limit')
const LIMIT       = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0

if (!LEAD_ID && !isAll) {
  console.error('Usage: node build_demo_tenant.mjs --lead-id <uuid> | --all [--limit N] [--dry-run] [--force] [--reseed-only]')
  process.exit(1)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Password generator ─────────────────────────────────────────────────────────
function genPassword() {
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
// ── Realistic Serbian mobile phone generator ──────────────────────────────────
// Prefixes: 060–069, 061–069 (Telekom/A1/Yettel ranges)
const SRB_PREFIXES = ['060','061','062','063','064','065','066','069']
const _usedPhones  = new Set()
function randomSrbPhone() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const prefix = SRB_PREFIXES[Math.floor(Math.random() * SRB_PREFIXES.length)]
    const n      = Math.floor(100_0000 + Math.random() * 900_0000).toString()
    const phone  = `+381 ${prefix.slice(1)} ${n.slice(0,3)} ${n.slice(3)}`
    if (!_usedPhones.has(phone)) { _usedPhones.add(phone); return phone }
  }
  return null // extremely unlikely
}

function daysAgo(days, hour = 10, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
function daysFromNow(days, hour = 10, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

// ── Firecrawl scrape ───────────────────────────────────────────────────────────
async function scrapeWebsite(websiteUrl) {
  if (!FIRECRAWL_KEY || !websiteUrl) return ''

  let base
  try {
    base = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    new URL(base)
  } catch { return '' }

  const domain = new URL(base).hostname.replace(/^www\./, '')
  const candidates = [base, `https://${domain}/usluge`, `https://${domain}/products`, `https://${domain}/proizvodi`]

  const parts = []
  for (const url of candidates.slice(0, 2)) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', url, '--format', 'markdown',
      ], { timeout: 25000, env: { ...process.env, FIRECRAWL_API_KEY: FIRECRAWL_KEY } })
      if (stdout?.trim()) parts.push(stdout.trim())
    } catch { /* continue */ }
  }

  return parts.join('\n\n---\n\n').slice(0, 5000)
}

// ── Pass 1: Business intelligence extraction ───────────────────────────────────
async function extractBusinessIntel(companyName, niche, websiteContent) {
  const prompt = `Extract business intelligence from this Serbian company's website. Return ONLY raw JSON.

{
  "brand_name": "Clean display name",
  "products_services": [
    { "name": "product/service name", "price": "price in RSD or null", "category": "category" }
  ],
  "usp": "main value proposition in 1 sentence",
  "top_categories": ["cat1", "cat2", "cat3"],
  "business_summary": "2-sentence description of what they sell/do"
}

Company: ${companyName}
Niche: ${niche || 'unknown'}
Website content:
${websiteContent || '(no website content)'}

If website content is sparse, infer from company name and niche. Always return valid JSON.`

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    return JSON.parse(resp.choices[0].message.content || '{}')
  } catch {
    return { brand_name: companyName, products_services: [], usp: '', top_categories: [], business_summary: '' }
  }
}

// ── Pass 2: Conversation generation ───────────────────────────────────────────
async function generateConversations(companyName, nicheKey, businessIntel, nicheConfig) {
  const products = (businessIntel.products_services || []).slice(0, 6)
    .map(p => `- ${p.name}${p.price ? ` (${p.price})` : ''}`)
    .join('\n')

  const channels = nicheConfig.channels || ['Instagram', 'WhatsApp', 'Facebook', 'Web']
  const crmSingular = nicheConfig.terminology?.singular || 'Klijent'

  const prompt = `You generate realistic Serbian social inbox conversations for a SmartFlow AI demo.

Company: ${companyName}
Industry: ${nicheConfig.label || nicheKey}
Products/services:
${products || '(infer from industry)'}

${businessIntel.business_summary ? `Business: ${businessIntel.business_summary}` : ''}

Generate 18 conversations spread across the last 30 days. Return ONLY raw JSON:
{
  "conversations": [
    {
      "id": "conv_1",
      "platform": "Instagram|WhatsApp|Facebook|Web",
      "customer_name": "Serbian full name",
      "messages": [
        { "role": "user", "text": "customer message in Serbian" },
        { "role": "assistant", "text": "AI response in Serbian, specific to their products" }
      ]
    }
  ]
}

REQUIREMENTS:
1. At least 4 conversations must use platform "WhatsApp"
2. At least 6 must use "Instagram", 2 "Facebook", 2 "Web"
3. Conversations: 2-6 messages each (vary the length — some short, some longer)
4. The LAST message in exactly ONE conversation must be: { "role": "system", "text": "[HUMAN_NEEDED]" }
   (This shows human escalation — customer is upset, asks for manager, or has a complex issue)
5. ALL text in Serbian (Latin script). Names: common Serbian first+last names.
6. Reference REAL products/services from the list above.
7. Include at least 3 returning customers (reference a previous visit/purchase).
8. AI responses are specific, helpful, reference real products/prices.
9. Include at least 2 complaints or difficult situations (urgent, frustrated customer tone).
10. Include at least 2 short conversations (just 2 messages — customer asks quick question, AI answers).
11. Vary the conversation types: price inquiry, booking request, service question, follow-up, complaint, gift idea, group inquiry, returning client.`

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.85,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const data = JSON.parse(resp.choices[0].message.content || '{}')
    return Array.isArray(data.conversations) ? data.conversations : []
  } catch {
    return []
  }
}

// ── Pass 3: CRM contacts for demo_crm ─────────────────────────────────────────
async function generateDemoCrm(companyName, nicheKey, businessIntel, nicheConfig, conversations) {
  const convIds = conversations.slice(0, 6).map((c, i) => c.id || `conv_${i + 1}`)
  const statuses = nicheConfig.terminology?.statuses || ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija']
  const singular = nicheConfig.terminology?.singular || 'Klijent'
  const products = (businessIntel.products_services || []).slice(0, 5).map(p => p.name).join(', ')

  // Build a niche-appropriate status distribution hint
  const isOrderNiche = ['ecommerce', 'furniture', 'fashion', 'supplements'].includes(nicheKey)
  const isApptNiche  = ['dental', 'medical', 'beauty', 'fitness', 'services', 'wellness'].includes(nicheKey)
  const distHint = isOrderNiche
    ? '~25% Novi, ~20% Zainteresovan, ~30% Naručio, ~10% Isporučeno, ~10% Reklamacija, ~5% Intervencija'
    : isApptNiche
      ? '~25% Novi, ~20% Zainteresovan, ~25% Zakazano, ~15% Završeno, ~10% Reklamacija, ~5% Intervencija'
      : '~30% Novi, ~25% Zainteresovan, ~20% ' + statuses[2] + ', ~15% ' + statuses[3] + ', ~8% Reklamacija, ~2% Intervencija'

  const prompt = `Generate CRM contacts for a Serbian business demo dashboard.

Company: ${companyName}
Industry: ${nicheConfig.label || nicheKey}
${products ? `Products/services: ${products}` : ''}
Available conversation IDs (link some contacts to these): ${convIds.join(', ')}

Return ONLY raw JSON:
{
  "contacts": [
    {
      "id_razgovora": "conv_1 or null",
      "full_name": "Serbian full name",
      "telefon": "+381 6x xxx xxxx",
      "kategorija": "category/topic relevant to this business",
      "proizvod": "specific product/service they inquired about",
      "status": "MUST be one of EXACTLY: ${statuses.join('|')}",
      "razlog": "reason for Zainteresovan or Reklamacija status, null otherwise",
      "izvor": "Instagram|WhatsApp|Facebook|Web|Preporuka|Telefon"
    }
  ]
}

Rules:
- Generate 14-16 contacts
- Status distribution: ${distHint}
- CRITICAL: Use ONLY the exact status values listed above — no other values allowed
- Link first 5-6 contacts to conversation IDs (others have null id_razgovora)
- ALL names in Serbian. Telefon format: +381 6x xxx xxxx
- Proizvod must reference real products/services from the business
- Include 2 Reklamacija contacts with specific razlog
- Include 1 Intervencija contact (urgent issue)
- razlog is useful for Zainteresovan (why they haven't ordered) and Reklamacija (what's wrong)`

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const data = JSON.parse(resp.choices[0].message.content || '{}')
    return Array.isArray(data.contacts) ? data.contacts : []
  } catch {
    return []
  }
}

// ── Pass 4: Services catalog + appointments ────────────────────────────────────
async function generateCatalogAndCalendar(companyName, nicheKey, businessIntel, nicheConfig) {
  const useCalendar = nicheConfig.useCalendar
  const useCatalog  = nicheConfig.useCatalog
  const isVisual    = nicheConfig.isVisualNiche
  const singular    = nicheConfig.terminology?.singular || 'Klijent'

  if (!useCatalog && !useCalendar) return { services: [], appointments: [] }

  const products = (businessIntel.products_services || []).slice(0, 8)
    .map(p => `- ${p.name}${p.price ? ` (${p.price})` : ''}${p.category ? ` [${p.category}]` : ''}`)
    .join('\n')

  const catalogPart = useCatalog ? `
"services": [
  {
    "name": "service/product name",
    "category": "category",
    "description": "1-2 sentence description in Serbian",
    "price_min": number_or_null,
    "price_max": number_or_null,
    "duration_minutes": number_or_null,
    "color_hex": "#hexcolor",
    "is_featured": true_or_false,
    "sort_order": number
  }
]` : ''

  const calendarPart = useCalendar ? `
"appointments": [
  {
    "customer_name": "Serbian full name",
    "customer_phone": "+381 6x xxx xxxx",
    "service_name": "service name from catalog",
    "service_color": "#hexcolor matching the service",
    "starts_at": "ISO datetime (spread across next 14 days, business hours 9-18h)",
    "ends_at": "ISO datetime (starts_at + duration)",
    "status": "confirmed|cancelled|completed|no_show",
    "urgency": "low|medium|high|null",
    "urgency_reason": "AI note about why this is urgent (if high) or null",
    "source": "WhatsApp|Instagram|Facebook|Web|Telefon"
  }
]` : ''

  const prompt = `Generate realistic demo catalog/calendar data for a Serbian business.

Company: ${companyName}
Industry: ${nicheConfig.label || nicheKey}
Known products/services:
${products || '(infer from industry)'}

Return ONLY raw JSON:
{${catalogPart ? '\n' + catalogPart + (calendarPart ? ',' : '') : ''}${calendarPart ? '\n' + calendarPart : ''}
}

${useCatalog ? `Services catalog rules:
- Generate 8-12 services/products
- Use colors from this palette: #0ea5e9 #10b981 #f97316 #8b5cf6 #ec4899 #ef4444 #f59e0b #06b6d4
- Mark 2-3 as is_featured: true
- Include price range (price_min/price_max) — use realistic Serbian RSD amounts
- Include duration_minutes for scheduling niches
- sort_order: 1 = most popular` : ''}

${useCalendar ? `Calendar rules:
- Generate 18-22 appointments spread across next 14 days
- Business hours: 9:00-18:00
- Status mix: ~65% confirmed, ~15% completed, ~10% cancelled, ~10% no_show
- Urgency: ~15% high (with AI urgency_reason), ~25% medium, ~60% low/null
- High urgency reasons are brief clinical/commercial notes in Serbian
- Include some double-bookings (same time slot, different customers) — real clinics have these` : ''}

ALL text in Serbian.`

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.75,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const data = JSON.parse(resp.choices[0].message.content || '{}')
    return {
      services:     Array.isArray(data.services)     ? data.services     : [],
      appointments: Array.isArray(data.appointments) ? data.appointments : [],
    }
  } catch {
    return { services: [], appointments: [] }
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────
function validateConversations(conversations, nicheConfig) {
  const errors = []

  if (conversations.length < 8) errors.push('Too few conversations (need ≥8)')

  const hasHumanNeeded = conversations.some(c =>
    (c.messages || []).some(m => m.text === '[HUMAN_NEEDED]')
  )
  if (!hasHumanNeeded) errors.push('Missing [HUMAN_NEEDED] message')

  const platforms = new Set(conversations.map(c => (c.platform || '').toLowerCase()))
  if (!platforms.has('whatsapp')) errors.push('Missing WhatsApp channel')

  return errors
}

// ── Supabase provisioning ──────────────────────────────────────────────────────
async function provisionTenant(sb, lead, brandName, password) {
  const email = lead.email
  let authEmail = email

  // Create auth user
  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.message.toLowerCase().includes('already') || authErr.code === 'email_exists') {
      const hash = randomBytes(3).toString('hex')
      authEmail = email.replace('@', `+demo${hash}@`)
      const { error: retryErr } = await sb.auth.admin.createUser({
        email: authEmail, password, email_confirm: true,
      })
      if (retryErr) throw new Error(`Auth user error (suffix): ${retryErr.message}`)
      console.log(`  Auth: ${authEmail} (suffixed)`)
    } else {
      throw new Error(`Auth user error: ${authErr.message}`)
    }
  } else {
    console.log(`  Auth: ${authEmail} (${authData?.user?.id || 'created'})`)
  }

  // Get or create client record
  const { data: existing } = await sb
    .from('clients').select('id').eq('email', authEmail).maybeSingle()

  let clientId
  if (existing) {
    clientId = existing.id
    console.log(`  Client: ${clientId} (already exists)`)
  } else {
    const { data: newClient, error: clientErr } = await sb
      .from('clients')
      .insert({ name: brandName || lead.company_name, email: authEmail })
      .select('id').single()
    if (clientErr) throw new Error(`Client insert: ${clientErr.message}`)
    clientId = newClient.id
    console.log(`  Client: ${clientId} (created)`)
  }

  return { clientId, authEmail }
}

// ── Module provisioning ────────────────────────────────────────────────────────
async function provisionModules(sb, clientId, nicheKey, nicheConfig) {
  const moduleKeys = nicheConfig.modules || ['business-crm', 'social-chatbot', 'chatbot-analytics']

  const LABEL_MAP = {
    'business-crm':      nicheConfig.crmLabel || 'Klijenti',
    'social-chatbot':    'AI Inbox',
    'agent-database':    nicheConfig.catalogLabel || 'Usluge',
    'calendar':          nicheConfig.calendarLabel || 'Termini',
    'chatbot-analytics': 'Analitika',
  }

  // Fix: analytics key must be 'chatbot-analytics', not 'analytics'
  const modules = moduleKeys.map((key, i) => ({
    client_id:    clientId,
    module_key:   key,       // already correct from niche-config.json
    is_enabled:   true,
    display_name: LABEL_MAP[key] || key,
    sort_order:   i + 1,
    settings:     null,
  }))

  // Delete stale modules (e.g. from old provisioning with wrong key)
  await sb.from('client_modules').delete().eq('client_id', clientId)

  const { error } = await sb
    .from('client_modules')
    .upsert(modules, { onConflict: 'client_id,module_key' })
  if (error) throw new Error(`Modules upsert: ${error.message}`)
  console.log(`  Modules: ${modules.map(m => m.module_key).join(', ')}`)
}

// ── Update client with niche ───────────────────────────────────────────────────
async function updateClientNiche(sb, clientId, nicheKey, brandColor) {
  const { error } = await sb
    .from('clients')
    .update({ demo_niche: nicheKey, demo_brand_color: brandColor })
    .eq('id', clientId)
  if (error) console.warn(`  ⚠ Failed to update demo_niche: ${error.message}`)
  else console.log(`  Niche: ${nicheKey}`)
}

// ── Seeders ────────────────────────────────────────────────────────────────────
const FEMALE_NAMES = new Set(['jovana', 'milica', 'ana', 'nina', 'iva', 'tamara', 'jelena', 'marija', 'maja', 'aleksandra', 'katarina', 'tijana'])
const PIC_MALE   = ['https://randomuser.me/api/portraits/men/32.jpg', 'https://randomuser.me/api/portraits/men/47.jpg', 'https://randomuser.me/api/portraits/men/67.jpg', 'https://randomuser.me/api/portraits/men/77.jpg']
const PIC_FEMALE = ['https://randomuser.me/api/portraits/women/44.jpg', 'https://randomuser.me/api/portraits/women/23.jpg', 'https://randomuser.me/api/portraits/women/61.jpg', 'https://randomuser.me/api/portraits/women/5.jpg']

function pickPic(name, idx) {
  const first = (name || '').split(' ')[0].toLowerCase()
  const pics = FEMALE_NAMES.has(first) ? PIC_FEMALE : PIC_MALE
  return pics[idx % pics.length]
}

const VALID_PLATFORMS = new Set(['instagram', 'facebook', 'website', 'whatsapp'])

// Distribute conversations across 30 days — weighted toward recent (more activity = more convincing demo)
const CONV_SPREAD_HOURS = [
  1, 4, 11, 20, 32, 47, 66, 90, 120, 156,
  200, 252, 312, 380, 456, 528, 600, 648, 696, 720,
]

async function seedRazgovori(sb, clientId, conversations) {
  const msgs = []
  conversations.forEach((conv, convIdx) => {
    const convId   = `demo_${clientId.slice(0, 8)}_${conv.id || convIdx + 1}`
    const pic      = pickPic(conv.customer_name, convIdx)
    const baseH    = CONV_SPREAD_HOURS[convIdx] ?? (720 + convIdx * 24)
    const platform = VALID_PLATFORMS.has((conv.platform || '').toLowerCase())
      ? conv.platform.toLowerCase() : 'instagram'

    ;(conv.messages || []).forEach((msg, msgIdx) => {
      msgs.push({
        id_razgovora: convId,
        role:         ['assistant', 'system'].includes(msg.role) ? msg.role : 'user',
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

async function seedDemoCrm(sb, clientId, contacts, conversations, nicheConfig) {
  // Build conv ID map so we can properly link
  const convIdMap = {}
  conversations.forEach((c, i) => {
    convIdMap[c.id || `conv_${i + 1}`] = `demo_${clientId.slice(0, 8)}_${c.id || i + 1}`
  })

  // Accept statuses from the niche config — never hardcode appointment statuses for product niches
  const nicheStatuses = nicheConfig?.terminology?.statuses || []
  const VALID_STATUSES = new Set([
    ...nicheStatuses,
    'Novi', 'Zainteresovan', 'Reklamacija', 'Intervencija', // always valid
  ])
  const VALID_IZVORI   = new Set(['Instagram', 'WhatsApp', 'Facebook', 'Web', 'Preporuka', 'Telefon'])

  const rows = contacts.map((c, i) => ({
    client_id:       clientId,
    id_razgovora:    c.id_razgovora ? (convIdMap[c.id_razgovora] || null) : null,
    full_name:       c.full_name || 'Klijent',
    email:           c.email || null,
    telefon:         randomSrbPhone(),
    kategorija:      c.kategorija || null,
    proizvod:        c.proizvod || null,
    status:          VALID_STATUSES.has(c.status) ? c.status : 'Novi',
    razlog:          c.razlog || null,
    status_porudzbine: c.status_porudzbine || null,
    izvor:           VALID_IZVORI.has(c.izvor) ? c.izvor : 'Instagram',
    komentar:        c.komentar || null,
    created_at:      daysAgo(i + 1, 9 + (i % 8), (i * 17) % 60),
  }))

  const { error } = await sb.from('demo_crm').insert(rows)
  if (error) throw new Error(`demo_crm insert: ${error.message}`)
  console.log(`  CRM: ${rows.length} contacts inserted`)
}

async function seedServicesCatalog(sb, clientId, services) {
  if (!services.length) return
  const rows = services.map((s, i) => ({
    client_id:       clientId,
    name:            s.name || `Usluga ${i + 1}`,
    category:        s.category || null,
    description:     s.description || null,
    price_min:       typeof s.price_min === 'number' ? s.price_min : null,
    price_max:       typeof s.price_max === 'number' ? s.price_max : null,
    duration_minutes: typeof s.duration_minutes === 'number' ? s.duration_minutes : null,
    image_url:       s.image_url || null,
    color_hex:       /^#[0-9a-fA-F]{6}$/.test(s.color_hex || '') ? s.color_hex : '#6366f1',
    is_featured:     !!s.is_featured,
    metadata:        s.metadata || null,
    sort_order:      typeof s.sort_order === 'number' ? s.sort_order : i + 1,
  }))

  const { error } = await sb.from('services_catalog').insert(rows)
  if (error) throw new Error(`services_catalog insert: ${error.message}`)
  console.log(`  Catalog: ${rows.length} services inserted`)
}

async function seedAppointments(sb, clientId, appointments, services) {
  if (!appointments.length) return

  // Build service color map + duration from catalog seed
  const serviceColors = {}
  const serviceDurations = {}
  services.forEach(s => {
    if (s.name) {
      serviceColors[s.name]    = s.color_hex || '#6366f1'
      serviceDurations[s.name] = s.duration_minutes || 60
    }
  })

  const VALID_STATUSES = new Set(['confirmed', 'cancelled', 'completed', 'no_show'])
  const VALID_URGENCY  = new Set(['low', 'medium', 'high'])

  const now = new Date()
  const SPREAD = appointments.length

  const rows = appointments.map((a, i) => {
    // Spread appointments: first 30% in the past (-4 to -1 days), rest in the future (1-12 days)
    const fraction = i / SPREAD
    const dayOffset = fraction < 0.3
      ? Math.round(-4 + fraction / 0.3 * 3)   // -4 to -1 for past appointments
      : Math.round(1 + (fraction - 0.3) / 0.7 * 11) // 1 to 12 for future
    const hour      = 9 + (i % 8)             // 9h–17h
    const minute    = [0, 30][i % 2]
    const startsAt  = daysFromNow(dayOffset, hour, minute)

    // Status must match temporal logic: past appts = completed/no_show, future = confirmed/cancelled
    const isPast = dayOffset < 0
    const deterministicStatus = isPast
      ? (i % 5 === 0 ? 'no_show' : 'completed')
      : (i % 7 === 0 ? 'cancelled' : 'confirmed')

    const duration = serviceDurations[a.service_name] || a.duration_minutes || 60
    const endsAt   = (() => {
      const d = new Date(startsAt)
      d.setMinutes(d.getMinutes() + duration)
      return d.toISOString()
    })()

    return {
      client_id:      clientId,
      customer_name:  a.customer_name || 'Klijent',
      customer_phone: randomSrbPhone(),
      service_name:   a.service_name || 'Usluga',
      service_color:  serviceColors[a.service_name] || a.service_color || '#6366f1',
      starts_at:      startsAt,
      ends_at:        endsAt,
      status:         deterministicStatus,
      urgency:        VALID_URGENCY.has(a.urgency) ? a.urgency : null,
      urgency_reason: a.urgency_reason || null,
      source:         a.source || 'Instagram',
      notes:          a.notes || null,
    }
  })

  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await sb.from('appointments').insert(rows.slice(i, i + BATCH))
    if (error) throw new Error(`appointments batch: ${error.message}`)
  }
  console.log(`  Calendar: ${rows.length} appointments inserted`)
}

// ── Delete stale seeds (for --reseed-only) ────────────────────────────────────
async function deleteStaleSeeds(sb, clientId) {
  await Promise.all([
    sb.from('demo_crm').delete().eq('client_id', clientId),
    sb.from('services_catalog').delete().eq('client_id', clientId),
    sb.from('appointments').delete().eq('client_id', clientId),
    sb.from('razgovori').delete().eq('client_id', clientId).like('id_razgovora', `demo_${clientId.slice(0, 8)}_%`),
  ])
}

// ── Build demo for one lead ────────────────────────────────────────────────────
async function buildDemoForLead(sb, lead) {
  const name = lead.company_name || '(no name)'
  console.log(`\n┌─ ${name}`)
  console.log(`│  ID:      ${lead.id}`)
  console.log(`│  Email:   ${lead.email}`)
  console.log(`│  Website: ${lead.website || '(none)'}`)

  if (lead.demo_built_at && !isForce && !isReseedOnly) {
    console.log(`│  ↷ Already built (${lead.demo_built_at}) — skipping (use --force or --reseed-only)`)
    console.log(`└─────`)
    return { skipped: true }
  }

  if (isReseedOnly && !lead.demo_client_id) {
    console.log(`│  ↷ No demo_client_id — skipping reseed (run without --reseed-only first)`)
    console.log(`└─────`)
    return { skipped: true }
  }

  if (isDryRun) {
    const igCategory = lead.intake_data?.enrichment?.instagram_profile?.business_category || ''
    const nicheKey = inferNicheKey(lead.niche || lead.niche_v2, igCategory, lead.company_name || '')
    console.log(`│  ✓ [DRY RUN] niche=${nicheKey}, modules=${NICHE_CONFIGS[nicheKey]?.modules?.join(',')}`)
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
    console.log(`│         ⚠ Scrape failed: ${err.message}`)
  }

  // Determine niche
  const rawNiche = lead.niche_v2 || lead.niche || ''
  const igCategory = lead.intake_data?.enrichment?.instagram_profile?.business_category || ''
  const nicheKey = inferNicheKey(rawNiche, `${igCategory} ${websiteContent.slice(0, 800)}`, lead.company_name || '')
  const nicheConfig = NICHE_CONFIGS[nicheKey] || NICHE_CONFIGS.generic
  console.log(`│  Niche: ${nicheKey} (from "${rawNiche || 'unknown'}")`)

  // Step 2a: Business intelligence extraction
  console.log(`│  [2a/5] Extracting business intel...`)
  const businessIntel = await extractBusinessIntel(name, nicheKey, websiteContent)
  const brandName = businessIntel.brand_name || name
  console.log(`│         Brand: ${brandName} | ${(businessIntel.products_services || []).length} products/services found`)

  await sleep(800)

  // Step 2b: Generate conversations
  console.log(`│  [2b/5] Generating conversations...`)
  let conversations = []
  let attempts = 0
  while (attempts < 3) {
    conversations = await generateConversations(brandName, nicheKey, businessIntel, nicheConfig)
    const errors = validateConversations(conversations, nicheConfig)
    if (errors.length === 0) break
    console.log(`│         ⚠ Validation (attempt ${attempts + 1}): ${errors.join(', ')} — retrying`)
    attempts++
    await sleep(500)
  }
  if (conversations.length === 0) {
    console.log(`│         ⚠ Failed to generate conversations after 3 attempts — using fallback`)
    conversations = buildFallbackConversations(brandName, nicheKey)
  }
  console.log(`│         ${conversations.length} conversations generated`)

  await sleep(800)

  // Step 2c: CRM contacts
  console.log(`│  [2c/5] Generating CRM contacts...`)
  const crmContacts = await generateDemoCrm(brandName, nicheKey, businessIntel, nicheConfig, conversations)
  console.log(`│         ${crmContacts.length} contacts`)

  await sleep(800)

  // Step 2d: Catalog + calendar (if needed)
  let services = [], appointments = []
  if (nicheConfig.useCatalog || nicheConfig.useCalendar) {
    console.log(`│  [2d/5] Generating catalog/calendar...`)
    const result = await generateCatalogAndCalendar(brandName, nicheKey, businessIntel, nicheConfig)
    services     = result.services || []
    appointments = result.appointments || []
    console.log(`│         ${services.length} services, ${appointments.length} appointments`)
    await sleep(800)
  }

  // Step 3: Provision tenant (skip if --reseed-only)
  let clientId, authEmail, password
  if (isReseedOnly) {
    clientId  = lead.demo_client_id
    authEmail = lead.demo_tenant_email
    password  = lead.demo_tenant_password
    console.log(`│  [3/5] Reseed-only — using existing client ${clientId}`)
    await deleteStaleSeeds(sb, clientId)
  } else {
    console.log(`│  [3/5] Provisioning Supabase tenant...`)
    password = genPassword()
    const provisioned = await provisionTenant(sb, lead, brandName, password)
    clientId  = provisioned.clientId
    authEmail = provisioned.authEmail
  }

  // Step 4: Upsert modules + niche
  console.log(`│  [4/5] Provisioning modules + niche...`)
  await provisionModules(sb, clientId, nicheKey, nicheConfig)
  await updateClientNiche(sb, clientId, nicheKey, nicheConfig.brandColor)

  // Step 5: Seed all tables
  console.log(`│  [5/5] Seeding data...`)
  await seedRazgovori(sb, clientId, conversations)
  await seedDemoCrm(sb, clientId, crmContacts, conversations, nicheConfig)
  if (nicheConfig.useCatalog && services.length) await seedServicesCatalog(sb, clientId, services)
  if (nicheConfig.useCalendar && appointments.length) await seedAppointments(sb, clientId, appointments, services)

  // Step 6: Writeback to contacts
  if (!isReseedOnly) {
    const { error: wbErr } = await sb.from('contacts').update({
      demo_tenant_email:    authEmail,
      demo_tenant_password: password,
      demo_tenant_url:      APP_URL,
      demo_built_at:        new Date().toISOString(),
      demo_client_id:       clientId,
    }).eq('id', lead.id)
    if (wbErr) throw new Error(`Writeback failed: ${wbErr.message}`)
  }

  console.log(`│`)
  console.log(`│  ✅ Done! Niche: ${nicheKey}`)
  console.log(`│  Login URL: ${APP_URL}`)
  console.log(`│  Email:     ${authEmail}`)
  if (password) console.log(`└─ Password:  ${password}`)
  else console.log(`└─────`)

  return { clientId, authEmail, password }
}

// ── Fallback conversations if LLM fails validation ─────────────────────────────
function buildFallbackConversations(brandName, nicheKey) {
  return [
    {
      id: 'conv_1', platform: 'instagram', customer_name: 'Jovana Petrović',
      messages: [
        { role: 'user', text: `Zdravo, zanima me cena vaših usluga za ${nicheKey}?` },
        { role: 'assistant', text: `Zdravo Jovana! Svakako, mogu da Vam pošaljem cenovnik. Koji termin Vam odgovara?` },
        { role: 'user', text: 'Sledeće nedelje bi mi odgovaralo.' },
        { role: 'assistant', text: 'Odlično! Imam slobodan termin u četvrtak u 10:00. Odgovara li Vam to?' },
      ],
    },
    {
      id: 'conv_2', platform: 'whatsapp', customer_name: 'Marko Nikolić',
      messages: [
        { role: 'user', text: 'Pozdrav, da li imate popust za stalne klijente?' },
        { role: 'assistant', text: 'Zdravo Marko! Da, nudimo 10% popust za stalne klijente. Možete iskoristiti odmah.' },
      ],
    },
    {
      id: 'conv_3', platform: 'facebook', customer_name: 'Ana Jovanović',
      messages: [
        { role: 'user', text: 'Nisam zadovoljna sa posednjom uslugom. Molim pojašnjenje.' },
        { role: 'assistant', text: 'Žao mi je što ste imali loše iskustvo. Možete li mi reći šta se desilo da bih mogao/la da pomognem?' },
        { role: 'user', text: 'Nikad ne odgovarate na poruke. Ovo je neprihvatljivo.' },
        { role: 'system', text: '[HUMAN_NEEDED]' },
      ],
    },
    {
      id: 'conv_4', platform: 'website', customer_name: 'Stefan Milić',
      messages: [
        { role: 'user', text: 'Kako mogu da zakažem termin?' },
        { role: 'assistant', text: 'Zdravo! Možete zakazati termin direktno ovde ili nas kontaktirati na +381 11 xxx xxxx. Koji termin Vam odgovara?' },
      ],
    },
  ]
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let leads = []

  const selectFields = 'id, company_name, email, website, niche, niche_v2, demo_built_at, demo_client_id, demo_tenant_email, demo_tenant_password'

  if (LEAD_ID) {
    const { data, error } = await sb.from('contacts').select(selectFields).eq('id', LEAD_ID).single()
    if (error) { console.error(`✗ Lead not found: ${error.message}`); process.exit(1) }
    leads = [data]
  } else {
    let q = sb
      .from('contacts')
      .select(selectFields)
      .eq('client_id', SMARTFLOW_ID)
      .in('status', ['enriched', 'No Draft', 'Kontaktiran'])
      .not('email', 'is', null)
      .order('instagram_followers', { ascending: false })

    if (!isForce && !isReseedOnly) q = q.is('demo_built_at', null)
    if (isReseedOnly) q = q.not('demo_client_id', 'is', null)
    if (LIMIT > 0) q = q.limit(LIMIT)

    const { data, error } = await q
    if (error) { console.error(`✗ Fetch error: ${error.message}`); process.exit(1) }
    leads = data || []
  }

  const date = new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
  console.log(`\nSmartFlow Demo Builder v2 — ${date}`)
  console.log(`Leads: ${leads.length}${isDryRun ? ' [DRY RUN]' : ''}${isForce ? ' [FORCE]' : ''}${isReseedOnly ? ' [RESEED-ONLY]' : ''}`)
  console.log(`OpenAI: ${OPENAI_MODEL}  |  Firecrawl: ${FIRECRAWL_KEY ? 'available' : 'NOT SET'}`)

  if (leads.length === 0) {
    console.log('\nNo leads to process.')
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

  console.log(`\n──────────────────────────────────────`)
  console.log(`Built: ${built} | Skipped: ${skipped} | Failed: ${failed}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
