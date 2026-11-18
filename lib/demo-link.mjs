// A lead's personal demo link: one click opens their demo, no login form.
// 2026-11-18: the 11-17 email carried a bare app.smartflow.rs link plus the lead's own address and a random 12-character password to type
// on a phone (reads like phishing); repeat openers (Bee Bike 5 opens, Domestico and Kompakt 4) never logged in, one lead of 27 did.
// The link carries a random 128-bit token kept on the demo tenant's auth user (app_metadata.demo_link_token). A random token, not an HMAC of
// the service key: production's key is not the one in .env.local (first deploy, 2026-11-18: every signed link 404'd).
// Shared by the route (app/d/[id]/[token]/route.ts) and the node scripts (send_outreach.mjs, readiness.mjs).
import { randomBytes, timingSafeEqual } from 'node:crypto'

export const DEMO_BASE = 'https://app.smartflow.rs'

/** constant-time token comparison */
export function tokenMatches(want, got) {
  if (!want || !got) return false
  const a = Buffer.from(String(want)), b = Buffer.from(String(got))
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The tenant's link, creating its token the first time. `admin` = a service-role supabase client.
 * generateLink is used to read the auth user by email (it sends nothing; the link it mints is never used here).
 * @param {any} admin @param {{ clientId: string, email: string }} t @param {string} [base]
 */
export async function ensureDemoLink(admin, { clientId, email }, base = DEMO_BASE) {
  if (!clientId || !email) throw new Error('ensureDemoLink: clientId and email are required')
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.user) throw new Error(`ensureDemoLink(${email}): ${error?.message || 'no auth user'}`)
  const am = data.user.app_metadata || {}
  let token = am.demo_link_token
  if (!token) {
    token = randomBytes(16).toString('base64url')
    const { error: upErr } = await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { ...am, demo_link_token: token } })
    if (upErr) throw new Error(`ensureDemoLink(${email}): ${upErr.message}`)
  }
  return `${base}/d/${clientId}/${token}`
}
