import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyDemoSig } from "@/lib/demo-link.mjs"
import { bootstrapPage } from "@/lib/supabase/demo-bootstrap"
import { recordDemoEvent } from "@/lib/demo-track-server"

/**
 * The lead's personal demo link (lib/demo-link.mjs): one click, no login form.
 * The session is minted and redeemed server-side exactly like /api/demo-login, then handed to the tab through
 * sessionStorage (lib/supabase/demo-bootstrap.ts). Every click mints a fresh session, so the link never expires.
 * `?check=1` only confirms the link resolves (used by readiness.mjs before a send): no session, nothing recorded,
 * so our own checks never look like a lead opening the demo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await params
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyDemoSig(id, sig, service)) return notFound()

  const admin = createClient(url, service)
  const { data: tenant } = await admin
    .from("clients").select("id,email,name").eq("id", id).not("demo_niche", "is", null).maybeSingle()
  if (!tenant?.email) return notFound()

  if (req.nextUrl.searchParams.get("check") === "1") {
    return NextResponse.json({ ok: true, name: tenant.name }, { headers: { "cache-control": "no-store" } })
  }

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: tenant.email })
  if (error || !link?.properties?.hashed_token) return failed()

  const redeemer = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: verified, error: verifyErr } = await redeemer.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  })
  if (verifyErr || !verified?.session) return failed()

  try {
    await recordDemoEvent(admin, verified.session.user.id, { kind: "click", ua: req.headers.get("user-agent") || "" })
  } catch {
    // tracking never blocks the demo
  }

  const { access_token, refresh_token } = verified.session
  return new NextResponse(bootstrapPage(tenant.name || "Demo", { access_token, refresh_token }, { operator: false }), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  })
}

function notFound() {
  return new NextResponse("Link nije važeći.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } })
}
function failed() {
  return new NextResponse("Demo trenutno ne može da se otvori. Pokušajte ponovo za minut.", {
    status: 500, headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
