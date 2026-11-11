/**
 * scrape_catalog_images.mjs — pull real product photography off a tenant's own
 * website and attach it to their catalogue.
 *
 * WHY THIS IS WORTH BUILDING ONCE
 * `services_catalog.image_url` has existed all along and 0 of 112 rows have ever
 * been filled, which quietly costs us in three separate places:
 *
 *   1. The demo conversation says "[slika proizvoda]" where a customer sent a
 *      photo — the single most-quoted feature of the product (the agent recognises
 *      an image) is illustrated with a placeholder string.
 *   2. The catalogue page is a wall of text, so it reads as a list we typed up
 *      rather than a mirror of their shop.
 *   3. The generated intro art has to invent generic merchandise, when Nano Banana
 *      accepts reference images and could be drawing THEIR products.
 *
 * One scrape per tenant fixes all three.
 *
 * Usage:
 *   node scrape_catalog_images.mjs --dry-run
 *   node scrape_catalog_images.mjs --email shop4@belodore.rs --yes
 *   node scrape_catalog_images.mjs --all --yes --limit 5
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim()
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const FIRECRAWL = process.env.FIRECRAWL_API_KEY
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351'

const argv = process.argv
const isDry = argv.includes('--dry-run')
const isYes = argv.includes('--yes')
const isForce = argv.includes('--force')
const isRebuild = argv.includes('--rebuild')  // replace the catalogue with what the shop really sells
const argOf = (f, d = null) => { const i = argv.indexOf(f); return i !== -1 ? argv[i + 1] : d }
const LIMIT = Number(argOf('--limit', 1))
const EMAIL = argOf('--email')

/** Junk that lives on every site and is never a product. */
const REJECT = /logo|favicon|sprite|icon|placeholder|banner|header|footer|avatar|badge|payment|visa|mastercard|instagram|facebook|whatsapp|\.svg($|\?)/i

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// This called the raw Firecrawl REST API with zero pacing between tenants — fine for
// --email (one tenant) but --all fires every request back to back, which blows through
// Firecrawl's ~30/min cap by the 11th tenant every time (confirmed 2026-09-11: every
// remaining tenant in a 20-tenant run failed "Rate limit exceeded", and the failure
// cascaded into the next pipeline stage too since it ran immediately after). One retry
// after a real pause is the same fix already proven in fill_website_summaries.mjs.
async function scrapeImages(site) {
  const attempt = async () => {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIRECRAWL}` },
      body: JSON.stringify({ url: site, formats: ['markdown', 'html'], onlyMainContent: false, timeout: 35000 }),
    })
    return res.json()
  }
  let j = await attempt()
  if (!j?.success && /rate limit/i.test(j?.error || '')) {
    await sleep(15000)
    j = await attempt()
  }
  if (!j?.success) throw new Error(`firecrawl: ${j?.error || JSON.stringify(j).slice(0, 160)}`)

  const found = []

  // Markdown carries alt text, which is the best matching signal when it exists.
  for (const m of (j.data?.markdown || '').matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    found.push({ alt: m[1].trim(), url: m[2] })
  }

  // But real shops lazy-load: Belodore renders 33 <img> tags and only 7 survive
  // into markdown. Parse the HTML too, including data-src/srcset, or we miss the
  // entire product grid — which is the only part we actually want.
  const html = j.data?.html || ''
  for (const m of html.matchAll(/(?:src|data-src|data-lazy-src|data-original)=["']([^"']+\.(?:jpe?g|png|webp|avif)[^"']*)["']/gi)) {
    found.push({ alt: '', url: m[1] })
  }

  const out = []
  const seen = new Set()
  for (const f of found) {
    let url = f.url
    if (!/^https?:\/\//i.test(url)) {
      try { url = new URL(url, site).href } catch { continue }
    }
    if (REJECT.test(url) || (f.alt && REJECT.test(f.alt))) continue
    if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)

    // These filenames are descriptive by convention — "Xerjoff_CORO_100ml_1.webp"
    // identifies the product better than most alt attributes do.
    const file = decodeURIComponent(url.split('/').pop() || '')
      .replace(/\.[a-z0-9]+(\?.*)?$/i, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\b\d{3,}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    out.push({ alt: f.alt || file, url })
  }
  return { images: out.slice(0, 80), markdown: j.data?.markdown || '' }
}

/**
 * Extract REAL products — name, price, photo — from the shop page.
 *
 * Matching photos onto an existing catalogue turned out to be the wrong shape of
 * problem: Belodore's seeded catalogue lists Xerjoff Erba Pura and Pernoire Melos,
 * while their storefront today features Creed Aventus and Kajal Almaz. The
 * catalogue was invented from an old scrape, so there was nothing to match against,
 * and pairing a real photo with the wrong fragrance is worse than no photo at all.
 *
 * So --rebuild replaces the guessed catalogue with what the shop is actually
 * selling right now. That is also what the tour claims out loud ("isti artikli,
 * iste cene, link ka Vašoj stranici proizvoda"), and it should be true.
 */
async function extractProducts(markdown, images, site) {
  const sys = `You extract a product catalogue from an online shop page.
Return ONLY a raw json object: {"products":[{"name":"","price":0,"category":"","image":"","url":""}]}
Rules:
- name: the product name exactly as the shop writes it.
- price: the number in RSD only, no currency, no thousands separators. Omit the product entirely if no price is visible.
- category: a short grouping you infer (e.g. "Muški parfemi", "Nega lica"). Keep it consistent.
- image: copy a url EXACTLY from the provided image list, choosing the one whose filename or alt matches this product. Omit the field if none matches — never guess.
- url: the product's own page url if one appears in the text, otherwise omit.
- Return at most 12 products, the ones most prominently featured.
- Never invent a product, a price, or an image url.`
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o', temperature: 0.1, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify({ site, page_text: markdown.slice(0, 24000), images }) },
      ],
    }),
  })
  const j = await res.json()
  const txt = j?.choices?.[0]?.message?.content
  if (!txt) throw new Error('extract failed')
  return (JSON.parse(txt).products || []).filter(p => p.name && p.price > 0)
}

/** Match scraped photos to catalogue rows by meaning, not string equality. */
async function matchImages(items, images) {
  const sys = `You match product photographs to catalogue entries.
Return ONLY a raw json object: {"matches": [{"name": "<exact catalogue name>", "url": "<image url>"}]}
Rules:
- Use ONLY urls from the provided list, copied exactly.
- Match on meaning: the image alt text and filename describe the same product or service as the catalogue name.
- A catalogue entry with no convincing photo must be OMITTED. A wrong photo is far worse than none.
- Never reuse the same url for two entries.`
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o', temperature: 0.2, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify({ catalogue: items.map(i => i.name), images }) },
      ],
    }),
  })
  const j = await res.json()
  const txt = j?.choices?.[0]?.message?.content
  if (!txt) throw new Error('match failed')
  return JSON.parse(txt).matches || []
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Catalogue images — from the tenant\'s own website')
  console.log(`  Mode: ${isDry ? 'DRY RUN (no API calls, no cost)' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════\n')

  let q = sb.from('clients').select('id,name,email,demo_niche').not('demo_niche', 'is', null)
  if (EMAIL) q = q.eq('email', EMAIL)
  const { data: clients } = await q.order('name')
  if (!clients?.length) { console.log('No matching tenants.'); return }

  let done = 0
  for (const c of clients) {
    if (done >= (EMAIL ? 1 : LIMIT)) break

    const { data: items } = await sb.from('services_catalog')
      .select('id, name, image_url').eq('client_id', c.id).eq('is_active', true)
    // --rebuild exists precisely FOR the empty ones; only the photo-matching path
    // needs rows to match against.
    if (!items?.length && !isRebuild) { console.log(`  ⊘ ${c.name} — empty catalogue, skipping`); continue }
    const missing = (items || []).filter(i => !i.image_url)
    if (!missing.length && !isForce && !isRebuild) { console.log(`  ✓ ${c.name} — all ${items.length} already have photos`); continue }

    const { data: lead } = await sb.from('contacts')
      .select('website').eq('client_id', SMARTFLOW_ID).eq('email', c.email).limit(1)
    const site = lead?.[0]?.website
    if (!site) { console.log(`  ⊘ ${c.name} — no website on the lead, skipping`); continue }

    console.log(`── ${c.name}  ${site}  (${missing.length}/${items?.length ?? 0} without a photo)`)
    if (isDry) { done++; continue }
    if (!isYes) { console.log('\nRefusing to spend without --yes.'); process.exit(1) }

    try {
      // 2.5s (24/min theoretical) still let 1 of ~20 tenants hit the cap in practice —
      // the account's effective ceiling under concurrent pipeline load is lower than
      // Firecrawl's own "30/min" error text implies. 5s (12/min) is the conservative fix.
      await sleep(5000)
      const { images, markdown } = await scrapeImages(site)
      console.log(`   scraped ${images.length} candidate photos`)
      if (!images.length) { done++; continue }

      if (isRebuild) {
        const products = await extractProducts(markdown, images, site)
        if (!products.length) { console.log('   ✗ no priced products found on the page\n'); done++; continue }
        // Replace rather than merge: a half-real catalogue is harder to trust than
        // either a fully invented one or a fully real one.
        await sb.from('services_catalog').delete().eq('client_id', c.id)
        const rows = products.map((p, i) => ({
          client_id: c.id,
          name: p.name,
          category: p.category || null,
          description: p.url || null,
          price_min: Math.round(p.price),
          price_max: Math.round(p.price),
          image_url: p.image || null,
          color_hex: ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899'][i % 5],
          sort_order: i + 1,
          is_active: true,
          is_featured: i < 3,
        }))
        const { error } = await sb.from('services_catalog').insert(rows)
        console.log(error ? `   ✗ insert: ${error.message}` : `   ✔ catalogue rebuilt: ${rows.length} real products, ${rows.filter(r => r.image_url).length} with photos`)
        rows.slice(0, 6).forEach(r => console.log(`      ${r.name.slice(0, 44).padEnd(44)} ${String(r.price_min).padStart(7)} RSD  ${r.image_url ? '📷' : '—'}`))
        const { data: cur0 } = await sb.from('clients').select('onboarding_copy').eq('id', c.id).single()
        await sb.from('clients').update({
          onboarding_copy: {
            ...(cur0?.onboarding_copy || {}),
            product_images: images.slice(0, 16).map(i => i.url),
            catalog_source: site.replace(/^https?:\/\//, '').replace(/\/$/, ''),
            catalog_synced_at: new Date().toISOString(),
          },
        }).eq('id', c.id)
        console.log('')
        done++
        continue
      }

      const matches = await matchImages(isForce ? items : missing, images)
      let applied = 0
      for (const m of matches) {
        const row = (items || []).find(i => i.name === m.name)
        if (!row || !m.url) continue
        const { error } = await sb.from('services_catalog').update({ image_url: m.url }).eq('id', row.id)
        if (!error) { applied++; console.log(`   ✔ ${row.name.slice(0, 40)} → ${m.url.slice(0, 70)}`) }
      }
      // Whatever didn't match a catalogue row is still genuine product photography
      // from their shop. The demo conversation needs one (it currently renders the
      // literal string "[slika proizvoda]"), and Nano Banana accepts reference
      // images — so the pool is worth keeping even when matching is thin.
      const matched = new Set(matches.map(m => m.url))
      const pool = images.filter(i => !matched.has(i.url)).slice(0, 12).map(i => i.url)
      const { data: cur } = await sb.from('clients').select('onboarding_copy').eq('id', c.id).single()
      await sb.from('clients').update({
        onboarding_copy: { ...(cur?.onboarding_copy || {}), product_images: [...matches.map(m => m.url), ...pool].slice(0, 16) },
      }).eq('id', c.id)

      console.log(`   ${applied} photo(s) attached · ${pool.length} kept as a product-image pool\n`)
    } catch (e) {
      console.log(`   ✗ ${c.name}: ${e.message}\n`)
    }
    done++
  }

  if (isDry) console.log('\nRe-run with --yes to scrape.')
}

main().catch(e => { console.error('✗ Fatal:', e.message); process.exit(1) })
