// Reads an Instagram profile page as Firecrawl returns it (markdown): followers, recent posts with views, cadence, and (for sourcing) name, bio, links.
const num = (s) => Number(String(s).replace(/,/g, ''))

export function parseProfile(md) {
  const f = /([\d.,]+)\s*([KkMm]?)\s+followers/.exec(md)
  const followers = f ? Math.round(num(f[1]) * ({ K: 1e3, M: 1e6 }[f[2].toUpperCase()] || 1)) : null
  const posts = []
  for (const l of md.split('\n')) {
    const m = /\]\(https?:\/\/(?:www\.)?instagram\.com\/p\/([\w-]+)\)\s*·\s*(\d{4}-\d{2}-\d{2})(.*)$/.exec(l)
    if (!m) continue
    const v = /([\d,]+)\s+(?:views?|plays?)/i.exec(m[3])
    posts.push({ sc: m[1], date: m[2], views: v ? num(v[1]) : null })
  }
  const reels = posts.filter((p) => p.views != null).map((p) => p.views).sort((a, b) => a - b)
  const dates = posts.map((p) => Date.parse(p.date)).sort((a, b) => b - a)
  const now = Date.now()
  return {
    followers, postsSeen: posts.length, reelsSeen: reels.length,
    medViews: reels.length ? reels[Math.floor(reels.length / 2)] : null, maxViews: reels.at(-1) ?? null,
    daysSincePost: dates.length ? Math.round((now - dates[0]) / 864e5) : null,
    postsLast30: posts.filter((p) => now - Date.parse(p.date) < 30 * 864e5).length,
    reelsLast30: posts.filter((p) => p.views != null && now - Date.parse(p.date) < 30 * 864e5).length,
    bioText: md.slice(0, 500),
  }
}

/** Name, bio and outbound links from the same markdown: "# Name (@handle) ✓  <bio text>  1,234 followers · 70 following  Links: https://…". */
export function parseHeader(md) {
  const lines = md.split('\n')
  const h = lines.findIndex((l) => /^# /.test(l))
  const head = h >= 0 ? lines[h].replace(/^# /, '') : ''
  const handle = /\(@([\w.]+)\)/.exec(head)?.[1] || null
  const fullName = head.replace(/\(@[\w.]+\).*$/, '').trim() || null
  const afterHandle = head.replace(/^.*\(@[\w.]+\)\s*✓?/, '')
  const rest = [afterHandle, ...lines.slice(h + 1)].join(' ')
  const fi = rest.search(/[\d.,]+\s*[KkMm]?\s+followers/)
  const bio = (fi > 0 ? rest.slice(0, fi) : rest.slice(0, 300)).replace(/\s+/g, ' ').trim()
  const links = [...md.matchAll(/https?:\/\/[^\s)<>"']+/g)].map((m) => m[0]).filter((u) => !/instagram\.com|facebook\.com|fb\.com|linktr\.ee|maps\.app|goo\.gl|wa\.me|bit\.ly|threads\.net|youtube\.com|tiktok\.com/i.test(u))
  const email = /[\w.%+-]+@[\w-]+\.[\w.]{2,}/.exec(bio)?.[0] || null
  return { handle, fullName, bio, website: links[0] || null, email }
}
