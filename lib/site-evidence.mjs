// The business's own pages, over plain HTTP: the evidence every demo claim is checked against.
//
// The first version followed only price/terms pages ("cenovnik", "usluge"…). JetSet's phones sit on
// /prodaja-mobilnih-telefona/ and /prodaja-polovnih-mobilnih-telefona/, its buyback on
// /otkup-…/; none of those words were followed, so a phone store was profiled as a repair service.
// Follow every page that names what the business sells or how it works.

const RELEVANT = /cen|usluge|proizvod|prodaj|prodavnic|shop|katalog|kolekcij|stanju|servis|otkup|ponud|paket|kako|o-nama|about|faq|placanj|plaćanj|isporuk|dostav|garancij|rate|kredit|kontakt|rezerv|zakaz|termin/i

export const pageText = (html) => String(html || '')
  .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
  // 2026-11-10: a struck-through price is the OLD price (Tandem showed <del>390</del> 370 and the demo quoted 390)
  .replace(/<(del|s|strike)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|section|article)>/gi, '. ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8211;|&ndash;/g, '–').replace(/&#8217;/g, '’').replace(/&#038;/g, '&')
  .replace(/(\.\s*){2,}/g, '. ').replace(/\s+/g, ' ').trim()

async function get(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) SmartflowDemoBuilder' } })
    return r.ok ? { url: r.url, html: await r.text() } : null
  } catch { return null }
}

/**
 * @param {string} site  domain or URL
 * @param {{maxPages?: number}} [opts]
 * @returns {Promise<{home: {url:string, html:string}|null, pages: {url:string, html:string, text:string}[], evidenceText: string, corpus: string}>}
 *   evidenceText is shortened for a model prompt; corpus is every fetched word, for verifying quotes
 */
export async function fetchSite(site, { maxPages = 7 } = {}) {
  if (!site) return { home: null, pages: [], evidenceText: '', corpus: '' }
  const base = /^https?:/.test(site) ? site : `https://${site}`
  const home = await get(base)
  if (!home) return { home: null, pages: [], evidenceText: '', corpus: '' }
  const host = new URL(home.url).host
  const links = [...home.html.matchAll(/href=["']([^"'#?]+)["']/gi)].map((m) => m[1])
    .map((h) => { try { return new URL(h, home.url).href } catch { return null } })
    .filter((h) => h && new URL(h).host === host && RELEVANT.test(new URL(h).pathname) && !/\.(jpg|png|webp|pdf|css|js)$/i.test(h))
  const pages = [{ ...home, text: pageText(home.html) }]
  for (const u of [...new Set(links)].slice(0, maxPages - 1)) {
    const p = await get(u)
    if (p) pages.push({ ...p, text: pageText(p.html) })
  }
  const evidenceText = pages.map((p, i) => `${i ? `[${new URL(p.url).pathname}] ` : ''}${p.text.slice(0, i ? 3500 : 5000)}`).join('\n\n').slice(0, 24000)
  return { home, pages, evidenceText, corpus: pages.map((p) => p.text).join('\n\n') }
}
