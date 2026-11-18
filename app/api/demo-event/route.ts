import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { recordDemoEvent, type DemoEvent } from "@/lib/demo-track-server"

/**
 * A demo tenant's browser reports a view or a tour step (lib/demo-track.ts). The caller proves who it is with its own
 * access token; only demo tenants (clients.demo_niche set) are recorded, so real clients and the operator never are.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  if (!token) return NextResponse.json({ ok: false }, { status: 401 })
  let body: any = null
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  let ev: DemoEvent
  if (body?.kind === "view") ev = { kind: "view" }
  else if (body?.kind === "step") ev = { kind: "step", step: Number(body.step), of: Number(body.of), slot: String(body.slot || "") }
  else return NextResponse.json({ ok: false }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user?.email) return NextResponse.json({ ok: false }, { status: 401 })
  const { data: tenant } = await admin.from("clients").select("id").eq("email", user.email).not("demo_niche", "is", null).maybeSingle()
  if (!tenant) return NextResponse.json({ ok: true, skipped: "not a demo tenant" })

  try { await recordDemoEvent(admin, user.id, ev) } catch { /* tracking never fails the page */ }
  return NextResponse.json({ ok: true })
}
