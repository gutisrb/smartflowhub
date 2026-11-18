import { createClient } from "@/lib/supabase/client"
import { DEMO_PREVIEW_KEYS } from "@/lib/supabase/demo-preview"

/**
 * Report a demo view or tour step to /api/demo-event. Silent and fire-and-forget: tracking never blocks or breaks the
 * demo. A tab opened by the operator's own preview button is skipped, so our checks never count as the lead's.
 */
export async function trackDemo(ev: { kind: "view" } | { kind: "step"; step: number; of: number; slot: string }) {
  try {
    if (typeof window === "undefined") return
    if (window.sessionStorage.getItem(DEMO_PREVIEW_KEYS.operator) === "1") return
    const { data: { session } } = await createClient().auth.getSession()
    if (!session?.access_token) return
    await fetch("/api/demo-event", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(ev),
    })
  } catch {
    // never surface tracking errors
  }
}
