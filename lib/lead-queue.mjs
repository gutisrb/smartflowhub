/**
 * The gate between "we scraped a business" and "Nikola should look at this".
 *
 * WHY THIS EXISTS
 * `lib/lead-score.mjs` defined the AOV and MIS gates months ago and documented them
 * as applying "downstream". Nothing ever imported it. Every sourcing script wrote
 * straight to `pipeline_stage: 'novi'`, and the cockpit's station 1 lists everything
 * at that stage — so raw scraper output and the approval queue were the same bucket.
 * On 2026-09-03 that queue held 68 leads: 53 of them with `instagram_followers: 0`
 * (a placeholder Google Maps hardcodes, not a measurement), 10 with no email address
 * at all, 4 with neither email nor Instagram, and one PVC-window company whose
 * scraped handle belonged to a bar.
 *
 * Sourcing finds businesses. This decides which of them have earned a decision.
 * Both the qualification script and the cockpit call it, so the UI cannot drift
 * back into showing unqualified rows if a script forgets to run.
 */

import { assessMarketingInvestment } from './lead-score.mjs'

/**
 * Fallback floor. The real one lives in machine_config.source_follower_floor —
 * the "Minimum Instagram pratilaca" field in the cockpit, set to 30.000. That
 * control existed but nothing read it, so pass it in and it is honoured.
 *
 * Either way the floor is overridden by real ad spend: a clinic with 1.200
 * followers and six live campaigns is buying DMs, which is what actually matters.
 */
export const MIN_FOLLOWERS = 5000

/** MIS at or above this proves paid demand regardless of audience size. */
const MIS_OVERRIDE = 35

/**
 * NFKD folds diacritics AND the mathematical-bold unicode some Instagram bios use
 * ("𝐏𝐑𝐎𝐃𝐀𝐉𝐀" → "PRODAJA"), which otherwise defeats every keyword below.
 * Cyrillic needs an explicit table — Serbian businesses write their own name in
 * Cyrillic and their handle in Latin, and comparing the two raw flags every one
 * of them as a mismatch.
 */
const CYR = {
  а:'a',б:'b',в:'v',г:'g',д:'d',ђ:'dj',е:'e',ж:'z',з:'z',и:'i',ј:'j',к:'k',л:'l',
  љ:'lj',м:'m',н:'n',њ:'nj',о:'o',п:'p',р:'r',с:'s',т:'t',ћ:'c',у:'u',ф:'f',х:'h',
  ц:'c',ч:'c',џ:'dz',ш:'s',
}

export function normalize(s) {
  if (!s) return ''
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[а-шђјљњћџ]/g, ch => CYR[ch] ?? ch)
    .replace(/đ/g, 'dj')
}

const collapse = s => normalize(s).replace(/[^a-z0-9]/g, '')
const domainOf = (website, email) => {
  const src = website || (email ? `https://${email.split('@')[1] ?? ''}` : '')
  if (!src) return ''
  try {
    const h = new URL(src.startsWith('http') ? src : `https://${src}`).hostname.replace(/^www\./, '')
    return /gmail|yahoo|hotmail|outlook|live\.com|mail\.ru/.test(h) ? '' : h.split('.')[0]
  } catch { return '' }
}

/** Geo and filler that businesses bolt onto a handle and that carry no identity. */
const HANDLE_FILLER = /^(srbija|srb|rs|serbia|beograd|bgd|bg|novisad|ns|kragujevac|kg|nis|subotica|su|official|oficijalni|shop|store|online|home|co|doo|hq)$/
const FILLER_AFFIX = ['srbija', 'serbia', 'beograd', 'novisad', 'kragujevac', 'subotica', 'official', 'oficijalni', 'doo', 'srb', 'bgd']

/**
 * A handle is sane if it shares a real word-stem with the company name or the
 * domain. Three ways to be related, because Serbian businesses abbreviate hard:
 *
 *   1. plain containment       — "l_decor_namestaj" ⊃ "ldecor"
 *   2. filler-stripped equality — "ahtsrbija" → "aht" === "AHT"
 *   3. prefix segmentation      — "_svstefan" → "sv"+"stefan" over "Sveti Stefan"
 *
 * Without (3) every abbreviated clinic name reads as a scraping error; with it,
 * "_septem.bar" on a PVC-window company still fails, which is the case that matters.
 */
export function handleLooksRelated(contact) {
  const handle = collapse((contact.instagram_handle || '').replace(/^@/, ''))
  if (!handle) return true // nothing to contradict

  const words = [
    ...normalize(contact.company_name).split(/[^a-z0-9]+/),
    collapse(domainOf(contact.website, contact.email)),
  ].filter(w => w.length >= 2 && !HANDLE_FILLER.test(w))
  if (!words.length) return true

  const name = collapse(contact.company_name)
  const domain = collapse(domainOf(contact.website, contact.email))

  // 1. containment either way, on the whole string and on each distinctive word.
  //    Handles reorder and pad freely — "ordinacija_bludent" is BluDent, and
  //    "cvejanovic_dentalclinic" buries the name at the front.
  for (const t of [name, domain].filter(t => t.length >= 4)) {
    if (handle.includes(t) || t.includes(handle)) return true
  }
  if (words.some(w => w.length >= 4 && handle.includes(w))) return true

  // 2. strip filler, then look for a whole-word hit. The filler is often glued on
  //    with no separator ("ahtsrbija"), so strip the collapsed string too.
  const parts = normalize(contact.instagram_handle || '').split(/[^a-z0-9]+/).filter(Boolean)
  let core = parts.filter(p => !HANDLE_FILLER.test(p)).join('')
  for (let changed = true; changed;) {
    changed = false
    for (const f of FILLER_AFFIX) {
      for (const re of [new RegExp(`${f}$`), new RegExp(`^${f}`)]) {
        if (re.test(core) && core.replace(re, '').length >= 3) { core = core.replace(re, ''); changed = true }
      }
    }
  }
  if (core && words.some(w => w === core || (core.length >= 4 && w.includes(core)))) return true

  // 3. segment the handle into prefixes of the name's words, in order
  const seen = new Set()
  // Word order in a handle is arbitrary, so segmentation consumes words in any
  // order — it only refuses to spend the same word twice.
  const canSegment = (rest, used, pieces) => {
    if (!rest) return pieces >= 1
    if (pieces >= 4) return false
    const key = `${rest}|${[...used].sort().join()}`
    if (seen.has(key)) return false
    seen.add(key)
    for (let i = 0; i < words.length; i++) {
      if (used.has(i)) continue
      const w = words[i]
      for (let len = Math.min(rest.length, w.length); len >= 2; len--) {
        if (w.startsWith(rest.slice(0, len)) && canSegment(rest.slice(len), new Set([...used, i]), pieces + 1)) return true
      }
    }
    return false
  }
  return canSegment(core || handle, new Set(), 0)
}

/**
 * Accounts that are not a business with a catalogue and a booking problem:
 * personal profiles, phone/clothes resellers, discount aggregators. These are
 * flagged for a human look rather than auto-killed — the patterns are cheap
 * heuristics and a wrong kill is expensive.
 */
const RESELLER = /\b(otkup|preprodaj|polovn|second ?hand|shopper|outlet|dropship|akcij|popust|sniz|deals?|travel under|do \d+ ?(e|eur|€)|under \d+)\b/i
const SURNAME = /(ić|ič|ic|vić|ović|ević|ski|ska)$/i
const BIZ_WORD = /\b(doo|d\.?o\.?o|studio|salon|shop|store|clinic|klinik|ordinacij|centar|center|company|kompani|group|grupa|design|dizajn|decor|fashion|hotel|restoran|caffe|kafe|market|gradnja|montaz|servis|sistem|solar|dental|estetik|beauty|nekretnin)\b/i

export function entityLooksWrong(contact) {
  const raw = normalize(contact.company_name)
  if (!raw) return false
  if (RESELLER.test(raw)) return true

  // A personal name: two words, the second carrying a Serbian surname ending,
  // no business word anywhere, and not styled as a brand (ALL CAPS).
  const words = String(contact.company_name).trim().split(/\s+/)
  const isAllCaps = contact.company_name === contact.company_name.toUpperCase()
  if (words.length === 2 && !isAllCaps && !BIZ_WORD.test(raw) && SURNAME.test(normalize(words[1])) && normalize(words[1]).length >= 5) return true

  return false
}

/**
 * @returns {{verdict:'ready'|'needs_enrichment'|'review'|'reject', reasons:string[], score:number, action:string}}
 */
export function qualifyForQueue(contact = {}, { followerFloor = MIN_FOLLOWERS } = {}) {
  const reasons = []
  const floor = Number(followerFloor) > 0 ? Number(followerFloor) : MIN_FOLLOWERS
  const email = (contact.email || '').trim()
  const handle = (contact.instagram_handle || '').trim()
  const followers = contact.instagram_followers

  const mis = assessMarketingInvestment(contact.intake_data || {}, contact.ig_profile || {})
  const adBacked = mis.score >= MIS_OVERRIDE

  // ── reach ──────────────────────────────────────────────────────────────────
  if (!email && !handle) reasons.push('unreachable')
  else if (!email) reasons.push('no_email')

  // ── audience ───────────────────────────────────────────────────────────────
  // Google Maps writes a literal 0 for every lead it inserts; it never looks at
  // Instagram. Treating that as "no audience" condemns good businesses, and
  // treating it as measured is worse — it is simply unknown until enrichment runs.
  if (followers == null || followers === 0) reasons.push('audience_unmeasured')
  else if (followers < floor && !adBacked) reasons.push('audience_too_small')

  // ── identity ───────────────────────────────────────────────────────────────
  if (handle && !handleLooksRelated(contact)) reasons.push('handle_mismatch')
  if (entityLooksWrong(contact)) reasons.push('review_entity')

  let verdict
  if (reasons.includes('unreachable')) verdict = 'reject'
  else if (reasons.includes('no_email') || reasons.includes('audience_unmeasured')) verdict = 'needs_enrichment'
  else if (reasons.length) verdict = 'review'
  else verdict = 'ready'

  const audiencePts = !followers ? 0
    : followers >= 50000 ? 35 : followers >= 20000 ? 28 : followers >= 10000 ? 20 : followers >= floor ? 12 : 4
  const score = Math.max(0, Math.min(100,
    audiencePts + Math.round(mis.score * 0.5) + (email ? 15 : 0) + (contact.website ? 5 : 0)
    - (reasons.includes('handle_mismatch') ? 10 : 0) - (reasons.includes('review_entity') ? 20 : 0)))

  const ACTION = {
    unreachable       : 'Nema ni email ni Instagram — odbaciti',
    no_email          : 'Pronaći kontakt email',
    audience_unmeasured: 'Izmeriti Instagram (pratioci + oglasi)',
    audience_too_small: 'Mala publika — proveriti da li plaćaju oglase',
    handle_mismatch   : 'Instagram handle ne odgovara firmi — proveriti ručno',
    review_entity     : 'Proveriti da li je uopšte firma sa katalogom',
  }

  return { verdict, reasons, score, mis: mis.score, action: reasons.length ? ACTION[reasons[0]] : 'Spreman za odluku' }
}
