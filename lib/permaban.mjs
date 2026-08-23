/**
 * Leads disqualified by a real conversation, not by a heuristic.
 *
 * A heuristic filter can be wrong and is worth re-running. These cannot: someone
 * sat in a meeting with them and established they will never buy. Re-sourcing one
 * costs a demo build, an email send, and — worst — founder attention on a name he
 * has already written off. So the ban is checked at every entry point rather than
 * being a status on a row that a fresh scrape would simply re-insert around.
 *
 * Add an entry only after a human decision. Include the reason and the date.
 */

export const PERMABAN = [
  {
    label: 'Plemenita Ulja',
    name: /plemenit[ao].?ulj/i,
    ig: /^plemenita_?ulja$/i,
    domain: /plemenitaulja\.rs$/i,
    email: /najboljeizprirode/i,
    reason: 'Met in person 2026-06 — zero buying intent, off-ICP. Confirmed dead 2026-07-06 and purged 2026-08-21.',
  },
]

function hostOf(website) {
  if (!website) return ''
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`)
      .hostname.replace(/^www\./, '')
  } catch { return '' }
}

/** Returns the matching ban entry, or null. Any one signal is enough. */
export function isPermabanned({ pageName, igHandle, website, email } = {}) {
  const host = hostOf(website)
  const handle = String(igHandle || '').replace(/^@/, '')
  return PERMABAN.find(b =>
    (pageName && b.name.test(pageName)) ||
    (handle && b.ig.test(handle)) ||
    (host && b.domain.test(host)) ||
    (email && b.email && b.email.test(email))
  ) || null
}
