import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { DEMO_PREVIEW_KEYS } from "@/lib/supabase/demo-preview"

/**
 * One-click entry into a lead's demo tenant.
 *
 * Checking a demo before sending it used to mean copying an email and a password
 * out of the cockpit and typing them into a login form — enough friction that demos
 * went out unseen.
 *
 * The magic link is redeemed HERE, server-side. Redirecting the browser to
 * Supabase's /auth/v1/verify instead sent it back to "/" carrying auth params that
 * nothing in this app consumes (there is no /auth/callback route, and the
 * cookie-based browser client will not complete a PKCE exchange for a link minted
 * server-side) — so no demo session was ever created and the tab simply re-rendered
 * the operator's own, still-valid, cookie session.
 *
 * The tokens are then handed to the tab through sessionStorage rather than cookies:
 * the operator and every demo tenant share one `sb-<ref>-auth-token` cookie name on
 * this origin, so a cookie hand-off would sign the operator out of their own
 * dashboard. See lib/supabase/demo-preview.ts.
 *
 * GUARDED: the caller must already be signed in as the SmartFlow operator account.
 * Without that check this route would hand a session for any tenant to anyone who
 * guessed the URL.
 */
const SMARTFLOW_CLIENT_ID = "69acf7e9-557e-4ca3-85bd-a785ef39e351"

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("email")
  if (!target) return NextResponse.json({ error: "email required" }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // ── who is asking? ────────────────────────────────────────────────────────
  const jar = await cookies()
  const ssr = createServerClient(url, anon, {
    cookies: { getAll: () => jar.getAll(), setAll: () => {} },
  })
  const { data: { user } } = await ssr.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: "not signed in" }, { status: 401 })

  const admin = createClient(url, service)
  const { data: operator } = await admin
    .from("clients").select("id").eq("email", user.email).eq("id", SMARTFLOW_CLIENT_ID).maybeSingle()
  if (!operator) return NextResponse.json({ error: "operator only" }, { status: 403 })

  // ── the target must actually be one of our demo tenants ───────────────────
  const { data: tenant } = await admin
    .from("clients").select("id,email,name").eq("email", target).not("demo_niche", "is", null).maybeSingle()
  if (!tenant) return NextResponse.json({ error: "not a demo tenant" }, { status: 404 })

  // ── mint a session, and redeem it here rather than in the browser ─────────
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target,
  })
  if (error || !link?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? "link failed" }, { status: 500 })
  }

  const redeemer = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: verified, error: verifyErr } = await redeemer.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  })
  if (verifyErr || !verified?.session) {
    return NextResponse.json({ error: verifyErr?.message ?? "verify failed" }, { status: 500 })
  }

  const { access_token, refresh_token } = verified.session
  return new NextResponse(bootstrapPage(tenant.name || target, { access_token, refresh_token }), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}

/**
 * Seeds this tab's storage and hard-navigates to the dashboard. A full load (not a
 * client-side route change) so the module-level Supabase client is rebuilt and picks
 * up the demo cookie adapter.
 */
function bootstrapPage(tenantName: string, tokens: { access_token: string; refresh_token: string }) {
  // < so a token can never terminate the script element early
  const payload = JSON.stringify(tokens).replace(/</g, "\\u003c")
  const name = tenantName.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))
  return `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><title>${name} — demo</title>
<style>
  html,body{height:100%;margin:0}
  body{display:grid;place-items:center;background:#05080c;color:#8fa3b8;
       font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
</style></head>
<body><p id="s">Otvaram demo — ${name}…</p>
<script>
(function () {
  try {
    var t = ${payload};
    sessionStorage.setItem(${JSON.stringify(DEMO_PREVIEW_KEYS.flag)}, "1");
    sessionStorage.setItem(${JSON.stringify(DEMO_PREVIEW_KEYS.pending)}, JSON.stringify(t));
    sessionStorage.removeItem(${JSON.stringify(DEMO_PREVIEW_KEYS.store)});
    location.replace("/");
  } catch (e) {
    document.getElementById("s").textContent = "Ne mogu da otvorim demo: " + (e && e.message);
  }
})();
</script></body></html>`
}
