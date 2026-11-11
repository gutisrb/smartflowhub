/**
 * Per-tab demo sessions.
 *
 * The operator account and every demo tenant live in the same Supabase project,
 * so they all want the same `sb-<ref>-auth-token` cookie on the same origin.
 * Signing into a demo through cookies would therefore sign the operator OUT of
 * their own dashboard — the exact friction the demo button exists to remove.
 *
 * sessionStorage is scoped to a single tab. Flagging the tab and backing
 * Supabase's cookie adapter with sessionStorage lets a demo tenant and the
 * operator be signed in side by side, in different tabs, with no collision.
 *
 * No "use client" directive: /api/demo-login (a server route) imports KEYS to
 * write the same storage slots from its bootstrap page.
 */

export const DEMO_PREVIEW_KEYS = {
  /** marks this tab as a demo preview */
  flag: "sf-demo-preview",
  /** the Supabase auth cookies, as this tab's storage sees them */
  store: "sf-demo-preview-cookies",
  /** freshly minted tokens waiting to be adopted, exactly once */
  pending: "sf-demo-preview-tokens",
} as const

export interface DemoTokens {
  access_token: string
  refresh_token: string
}

interface StoredCookie {
  name: string
  value: string
}

// Private windows and blocked site data make the accessor itself throw.
const ss = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

export const isDemoPreview = (): boolean => ss()?.getItem(DEMO_PREVIEW_KEYS.flag) === "1"

/** The cookie adapter shape @supabase/ssr expects, backed by this tab only. */
export const demoCookieStore = {
  getAll(): StoredCookie[] {
    const s = ss()
    if (!s) return []
    try {
      const parsed = JSON.parse(s.getItem(DEMO_PREVIEW_KEYS.store) || "[]")
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },
  setAll(cookies: StoredCookie[]) {
    const s = ss()
    if (!s) return
    const merged = new Map(demoCookieStore.getAll().map((c) => [c.name, c.value]))
    for (const { name, value } of cookies) {
      if (value) merged.set(name, value)
      else merged.delete(name)
    }
    const next: StoredCookie[] = [...merged].map(([name, value]) => ({ name, value }))
    s.setItem(DEMO_PREVIEW_KEYS.store, JSON.stringify(next))
  },
}

/**
 * Hand the tokens minted by /api/demo-login to the client, before anything reads
 * the session. Consumes them, so a refresh runs on the stored session instead.
 */
export async function adoptDemoSession(supabase: {
  auth: { setSession: (t: DemoTokens) => Promise<unknown> }
}): Promise<boolean> {
  const s = ss()
  if (!s) return false
  const raw = s.getItem(DEMO_PREVIEW_KEYS.pending)
  if (!raw) return false
  s.removeItem(DEMO_PREVIEW_KEYS.pending)
  try {
    await supabase.auth.setSession(JSON.parse(raw) as DemoTokens)
    return true
  } catch {
    return false
  }
}
