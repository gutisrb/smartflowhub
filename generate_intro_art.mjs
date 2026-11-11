/**
 * generate_intro_art.mjs — per-tenant opening wallpaper for the onboarding intro, drawn by
 * Nano Banana 2 on kie.ai from the business's OWN photographs.
 *
 * WHY
 * The intro slide is the first thing a lead ever sees of SmartFlow. It has to look like THEIR
 * business. Until 2026-11-10 it did not: the request carried no reference images at all (the
 * helper took an imageUrls argument and dropped it), and the prompt was one fixed paragraph
 * (four phones, a wall screen, an empty chair) plus three phrases a model invented. Nine leads,
 * one picture. Nikola: "it's mainly the prompt and the inputs you put in the requests".
 *
 * NOW (all of it automatic, for every future build — run_pipeline.mjs Stage 4b)
 *   1. gather the business's own evidence and pictures      lib/intro-art-inputs.mjs
 *        site pages (og:image, sliders, galleries), scraped product photos, catalogue photos,
 *        its own Instagram post photos, logo colours read from the logo's pixels, its own words,
 *        the Business Sheet sentence on how it sells, real customer questions
 *   2. assemble the brief from that evidence (no model call)  lib/intro-art.mjs  buildIntroBrief()
 *   3. send up to 5 of its real photographs as image_input     (nano-banana-2 accepts up to 10)
 *   4. a lead with no photograph gets a TEXT-ONLY brief, labelled as such; a lead with nothing
 *      verified gets no art at all (the intro then shows the shared backdrop) — never a
 *      confident picture of the wrong business.
 *
 * The art is atmosphere. The claim on top of it stays text we control, and the real logo is
 * composited over it in the UI (a model-drawn logo was once a convincing counterfeit).
 *
 * COST
 * Paid per image. --dry-run builds every brief, probes the pictures over plain HTTP and prints
 * the full prompt + the reference list; it spends nothing and writes nothing. A live run needs
 * --yes and is capped by --limit (default 1). Existing art is never regenerated without --force,
 * and --force first copies the old file to backups/intro-art/.
 *
 * Usage:
 *   node generate_intro_art.mjs --pipeline --dry-run                      # the demos in "Demo se pravi"/"Email spreman"
 *   node generate_intro_art.mjs --email varmus.info@gmail.com --dry-run   # one lead (comma-separate several)
 *   node generate_intro_art.mjs --email varmus.info@gmail.com --force --yes
 *   node generate_intro_art.mjs --pipeline --force --yes --limit 9
 *   node generate_intro_art.mjs --all --yes --limit 20                    # what run_pipeline.mjs does: tenants without art
 * Flags: --out-dir <dir> (dry-run: also write each prompt to <dir>/<email>.txt)
 *        --model nano-banana-2 | nano-banana-2-lite   --resolution 1K | 2K | 4K (default 1K)
 *
 * A hand sheet may steer one lead: sheets/<email>.json  "intro": { "hero_image": url, "exclude_images": [urls], "note": "…" }
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { gatherIntroInputs } from './lib/intro-art-inputs.mjs'
import { buildIntroBrief } from './lib/intro-art.mjs'
import { pipelineTenants } from './lib/pipeline-tenants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim()
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const KIE = process.env.KIE_API_KEY
const OUT_DIR = resolve(__dirname, 'public/onboarding/intro')
const BACKUP_DIR = resolve(__dirname, 'backups/intro-art')

const argv = process.argv
const isDry = argv.includes('--dry-run')
const isYes = argv.includes('--yes')
const isForce = argv.includes('--force')
const argOf = (f, d = null) => { const i = argv.indexOf(f); return i !== -1 ? argv[i + 1] : d }
const LIMIT = Number(argOf('--limit', 1))
const EMAILS = (argOf('--email') || '').split(',').map((s) => s.trim()).filter(Boolean)
const ALL = argv.includes('--all')
const PIPELINE = argv.includes('--pipeline')
const PROMPT_DIR = argOf('--out-dir')
// nano-banana-2 is the model kie documents with image_input (up to 10 URLs). The old "-lite" id is not in
// their current docs and nothing says it takes references, so it is opt-in.
const MODEL = argOf('--model', 'nano-banana-2')
const RESOLUTION = argOf('--resolution', '1K')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const KIE_HEAD = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${KIE}` })

/** Hand a picture to kie as a URL it can fetch: re-encode (size, format) and upload; uploads are free and expire in 24 h. */
async function uploadReference(ref, n) {
  const jpg = await sharp(ref.buf).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  const res = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
    method: 'POST', headers: KIE_HEAD(),
    body: JSON.stringify({ base64Data: `data:image/jpeg;base64,${jpg.toString('base64')}`, uploadPath: 'smartflow/intro-refs', fileName: `ref-${Date.now()}-${n}.jpg` }),
  })
  const j = await res.json()
  const url = j?.data?.downloadUrl
  if (!j?.success && j?.code !== 200 || !url) throw new Error(`reference upload failed: ${j?.msg || JSON.stringify(j).slice(0, 160)}`)
  return url
}

async function createTask(prompt, imageUrls) {
  const input = { prompt, aspect_ratio: '16:9', resolution: RESOLUTION, output_format: 'jpg' }
  if (imageUrls.length) input.image_input = imageUrls
  const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', { method: 'POST', headers: KIE_HEAD(), body: JSON.stringify({ model: MODEL, input }) })
  const j = await res.json()
  if (j.code !== 200 || !j.data?.taskId) throw new Error(`createTask ${j.code}: ${j.msg || JSON.stringify(j).slice(0, 200)}`)
  return j.data.taskId
}

async function awaitTask(taskId) {
  for (let i = 0; i < 60; i++) {
    await sleep(5000)
    const j = await (await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, { headers: { Authorization: `Bearer ${KIE}` } })).json()
    const st = j?.data?.state
    process.stdout.write('.')
    if (st === 'success') {
      const url = JSON.parse(j.data.resultJson || '{}')?.resultUrls?.[0]
      if (!url) throw new Error('success but no resultUrls')
      return url
    }
    if (st === 'fail') throw new Error(`task failed: ${j.data.failMsg || j.data.failCode}`)
  }
  throw new Error('timed out after 5 min')
}

/**
 * The model can render a 2.35:1 cinematic frame inside a 16:9 canvas, leaving dead black bars.
 * Those survive object-cover on a wide viewport and read as a broken image: scan in from the top
 * and bottom for the first row that carries picture, and cut there.
 */
async function trimLetterbox(buf) {
  const img = sharp(buf)
  const { width, height } = await img.metadata()
  if (!width || !height) return buf
  const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true })
  const rowMax = (y) => { let m = 0; for (let x = 0; x < info.width; x += 4) m = Math.max(m, data[y * info.width + x]); return m }
  const THRESHOLD = 16
  let top = 0, bottom = info.height - 1
  while (top < info.height && rowMax(top) < THRESHOLD) top++
  while (bottom > top && rowMax(bottom) < THRESHOLD) bottom--
  const keep = bottom - top + 1
  if (keep < info.height * 0.5 || keep === info.height) return buf
  const sy = Math.round((top / info.height) * height), sh = Math.round((keep / info.height) * height)
  console.log(` [trimmed ${height - sh}px of letterbox]`)
  return sharp(buf).extract({ left: 0, top: sy, width, height: sh }).jpeg({ quality: 92 }).toBuffer()
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  writeFileSync(dest, await trimLetterbox(Buffer.from(await res.arrayBuffer())))
}

const kb = (n) => `${Math.round(n / 1024)} KB`

function printInputs(inp, brief) {
  console.log(`   site: ${inp.site || '—'} · ${inp.pagesFetched} page(s) read · ${inp.candidates} candidate picture(s) ranked, ${inp.tried} probed, ${inp.refs.length} usable`)
  console.log(`   INPUT LEVEL: ${brief.level === 'photos' ? `PHOTOS — ${brief.refs.length} reference image(s) would be sent` : brief.level === 'text-only' ? 'TEXT-ONLY — no usable photograph (lesser input, labelled)' : 'NONE — nothing verified, no art would be generated'}`)
  brief.refs.forEach((r, n) => console.log(`     ${n + 1}. [${r.source}] ${r.width}x${r.height} ${kb(r.bytes)}${r.caption ? ` “${r.caption.slice(0, 70)}”` : ''}\n        ${r.url}`))
  const rej = inp.rejected.slice(0, 6)
  if (rej.length) console.log(`   skipped: ${rej.map((x) => `${x.url.split('/').slice(-1)[0].slice(0, 34)} (${x.reason})`).join(' · ')}${inp.rejected.length > 6 ? ` … +${inp.rejected.length - 6}` : ''}`)
  console.log(`   logo: ${inp.logo.url || 'none found'} → ${inp.logoColours.length ? inp.logoColours.map((c) => `${c.hex} ${Math.round(c.share * 100)}%`).join(', ') : 'no chromatic colour'}${inp.siteColours.length ? ` · site declares ${inp.siteColours.map((c) => `${c.hex} (${c.from})`).join(', ')}` : ''}`)
  console.log(`   app accent (niche default, NOT the brand): ${inp.accent}`)
  for (const n of brief.notes) console.log(`   note: ${n}`)
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Intro art — ${MODEL} @ ${RESOLUTION}, brief built from the business's own photos`)
  console.log(`  Mode: ${isDry ? 'DRY RUN (prints prompt + reference list; no paid call, no write)' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════\n')

  const emails = PIPELINE ? await pipelineTenants() : EMAILS
  let q = sb.from('clients').select('id,name,email,demo_niche,demo_brand_color,onboarding_copy').not('demo_niche', 'is', null)
  if (emails.length) q = q.in('email', emails)
  else if (!ALL) { console.log('Say which tenants: --email a@b.com[,c@d.com] | --pipeline | --all'); return }
  const { data: clients } = await q.order('name')
  if (!clients?.length) { console.log('No matching tenants.'); return }

  mkdirSync(OUT_DIR, { recursive: true })
  const pendingRelinks = []
  const todoAll = clients.filter((c) => {
    const has = existsSync(resolve(OUT_DIR, `${c.id}.jpg`))
    if (!has || isForce || isDry) return true
    // the image can exist while the DB link is gone (build_demo_tenant once overwrote onboarding_copy on every re-seed): re-link for free
    if (!c.onboarding_copy?.intro_art) { pendingRelinks.push(c); console.log(`  ↺ ${c.name} — art on disk but link missing, re-linking`) }
    else console.log(`  ✓ ${c.name} — art already exists, skipping`)
    return false
  })
  for (const c of pendingRelinks) {
    await sb.from('clients').update({ onboarding_copy: { ...(c.onboarding_copy || {}), intro_art: `/onboarding/intro/${c.id}.jpg`, intro_art_at: new Date().toISOString() } }).eq('id', c.id)
  }
  const todo = todoAll.slice(0, (ALL || PIPELINE || emails.length > 1) ? (isDry ? 99 : LIMIT) : 1)
  if (!todo.length) { console.log('\nNothing to generate.'); return }

  if (!isDry && !isYes) { console.log(`\nWould generate ${todo.length} image(s). Refusing to spend without --yes.`); process.exit(1) }
  if (!isDry && !KIE) { console.log('KIE_API_KEY missing.'); process.exit(1) }

  let made = 0, skipped = 0
  for (const c of todo) {
    console.log(`── ${c.name}  [${c.email}]${existsSync(resolve(OUT_DIR, `${c.id}.jpg`)) ? '  (art exists' + (isForce ? ', --force replaces it)' : isDry ? '; a live run skips it without --force)' : ')') : ''}`)
    try {
      const inp = await gatherIntroInputs(sb, c)
      const brief = buildIntroBrief(inp)
      printInputs(inp, brief)

      if (brief.level === 'none') { console.log('   ⏭  skipped: nothing verified to draw from (the intro keeps the shared backdrop)\n'); skipped++; continue }

      if (isDry) {
        console.log(`   PROMPT (${brief.prompt.length} chars):\n${brief.prompt.split('\n').map((l) => '   │ ' + l).join('\n')}\n`)
        if (PROMPT_DIR) { mkdirSync(PROMPT_DIR, { recursive: true }); writeFileSync(resolve(PROMPT_DIR, `${c.email}.txt`), `${brief.prompt}\n\n--- REFERENCES (${brief.refs.length}) ---\n${brief.refs.map((r, n) => `${n + 1}. [${r.source}] ${r.url}`).join('\n')}\n`) }
        continue
      }

      process.stdout.write(`   uploading ${brief.refs.length} reference(s)… `)
      const urls = []
      for (const [n, r] of brief.refs.entries()) urls.push(await uploadReference(r, n))
      console.log('done')
      const taskId = await createTask(brief.prompt, urls)
      process.stdout.write(`   task ${taskId.slice(0, 12)}… `)
      const url = await awaitTask(taskId)
      const dest = resolve(OUT_DIR, `${c.id}.jpg`)
      if (existsSync(dest)) { mkdirSync(BACKUP_DIR, { recursive: true }); copyFileSync(dest, resolve(BACKUP_DIR, `${c.id}-${Date.now()}.jpg`)) }
      await download(url, dest)
      await sb.from('clients').update({
        onboarding_copy: {
          ...(c.onboarding_copy || {}),
          intro_art: `/onboarding/intro/${c.id}.jpg`,
          intro_art_at: new Date().toISOString(),
          // what the picture was made from, so nobody mistakes a text-only render for a photo-based one
          intro_art_inputs: { level: brief.level, model: MODEL, refs: brief.refs.map((r) => ({ url: r.url, source: r.source })), palette: inp.logoColours.map((x) => x.hex), notes: brief.notes },
          // composited over the art in the UI — guaranteed to be their real mark
          brand_logo: inp.logo.url || (c.onboarding_copy || {}).brand_logo || null,
        },
      }).eq('id', c.id)
      console.log(` saved → public/onboarding/intro/${c.id}.jpg\n`)
      made++
    } catch (e) {
      console.log(`\n   ✗ ${c.name}: ${e.message}\n`)
    }
  }
  if (isDry) console.log(`${todo.length - skipped} brief(s) built, ${skipped} skipped. Nothing was sent or written. Re-run without --dry-run and with --yes to draw.`)
  else console.log(`\n${made} image(s) generated, ${skipped} skipped.`)
}

main().catch((e) => { console.error('✗ Fatal:', e.message); process.exit(1) })
