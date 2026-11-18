import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * What a lead did with their demo, kept on the demo tenant's own auth user (app_metadata.demo_track) so no pipeline
 * script that rewrites contacts.intake_data can clobber it. Read it with `node demo_activity.mjs`.
 * click = the link in the email was fetched (a mail scanner can do this too); view = the dashboard actually loaded in a
 * browser; step = a tour card was reached (max_step / of shows how far they got).
 */
export type DemoEvent =
  | { kind: "click"; ua?: string }
  | { kind: "view" }
  | { kind: "step"; step: number; of: number; slot: string }

export async function recordDemoEvent(admin: SupabaseClient, userId: string, ev: DemoEvent) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data?.user) return
  const am = (data.user.app_metadata || {}) as Record<string, unknown>
  const t = { ...((am.demo_track as Record<string, any>) || {}) }
  const now = new Date().toISOString()
  if (ev.kind === "click") {
    t.clicks = (t.clicks || 0) + 1
    t.first_click = t.first_click || now
    t.last_click = now
    if (ev.ua) t.ua = ev.ua.slice(0, 160)
  } else if (ev.kind === "view") {
    t.views = (t.views || 0) + 1
    t.first_view = t.first_view || now
    t.last_view = now
  } else {
    const step = Math.max(0, Math.floor(Number(ev.step) || 0))
    const of = Math.max(0, Math.floor(Number(ev.of) || 0))
    t.max_step = Math.max(t.max_step ?? -1, step)
    t.of = of || t.of
    const slots = { ...(t.slots || {}) }
    const slot = String(ev.slot || "").slice(0, 40)
    if (slot && !slots[slot]) slots[slot] = now
    t.slots = slots
    t.last_step_at = now
  }
  await admin.auth.admin.updateUserById(userId, { app_metadata: { ...am, demo_track: t } })
}
