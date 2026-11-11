/**
 * Pick a funded Apify key.
 *
 * Keys drain fast on the free plan ($5/month hard cap) and a drained one does not fail
 * gracefully — the actor start returns "Monthly usage hard limit exceeded" and the whole
 * script dies, after the free work is already done. run_pipeline.mjs rotated keys, but
 * standalone runs read APIFY_TOKEN straight from .env.local and hit the dead key anyway.
 * This makes both paths behave identically.
 *
 * Reads APIFY_TOKEN, APIFY_TOKEN_2, APIFY_TOKEN_3… and returns the first with enough
 * headroom. Returns null if none qualify, so the caller can stop before spending.
 */
export async function apifyHeadroom(token) {
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me/limits?token=${token}`)
    const d = (await r.json())?.data
    if (!d) return null
    const used = d.current?.monthlyUsageUsd ?? 0
    const cap  = d.limits?.maxMonthlyUsageUsd ?? 5
    return { used, cap, left: cap - used }
  } catch { return null }
}

export function apifyKeyCandidates() {
  const out = []
  for (const label of ['APIFY_TOKEN', 'APIFY_TOKEN_2', 'APIFY_TOKEN_3', 'APIFY_TOKEN_4']) {
    const t = process.env[label]
    if (t && !out.some(([, v]) => v === t)) out.push([label, t])
  }
  return out
}

export async function pickApifyToken(needUsd = 0.25, { quiet = false } = {}) {
  for (const [label, token] of apifyKeyCandidates()) {
    const h = await apifyHeadroom(token)
    if (!h) { if (!quiet) console.log(`  ${label}: unreadable (bad key?) — skipping`); continue }
    const ok = h.left >= needUsd
    if (!quiet) console.log(`  ${label}: $${h.used.toFixed(2)}/$${h.cap} used · $${h.left.toFixed(2)} left — ${ok ? 'usable' : `too low for ~$${needUsd}`}`)
    if (ok) return { label, token, ...h }
  }
  return null
}
