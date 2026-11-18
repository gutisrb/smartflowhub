// A lead's personal demo link: one click opens their demo, no login form.
// 2026-11-18: 26 leads opened the 11-17 email (Bee Bike 5 times, Domestico and Kompakt 4 each) and ONE logged in. The email carried a bare
// app.smartflow.rs link plus their own address and a random 12-character password to type on a phone, which reads like phishing.
// The link is signed (HMAC of the demo tenant's client id, keyed with the service-role key, which never leaves the server), so it cannot be
// guessed for another tenant. Shared by the route (app/d/[id]/[sig]/route.ts) and the node scripts (send_outreach.mjs, readiness.mjs).
import { createHmac, timingSafeEqual } from 'node:crypto'

export const DEMO_BASE = 'https://app.smartflow.rs'

/** @param {string} clientId @param {string} secret */
export function demoLinkSig(clientId, secret) {
  if (!clientId || !secret) throw new Error('demoLinkSig: clientId and secret are required')
  return createHmac('sha256', secret).update(`demo-link:v1:${clientId}`).digest('base64url').slice(0, 22)
}

/** @param {string} clientId @param {string} secret @param {string} [base] */
export function demoLink(clientId, secret, base = DEMO_BASE) {
  return `${base}/d/${clientId}/${demoLinkSig(clientId, secret)}`
}

/** @param {string} clientId @param {string} sig @param {string} secret */
export function verifyDemoSig(clientId, sig, secret) {
  if (!clientId || !sig || !secret) return false
  const want = Buffer.from(demoLinkSig(clientId, secret))
  const got = Buffer.from(String(sig))
  return got.length === want.length && timingSafeEqual(got, want)
}
