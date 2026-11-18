import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// 2026-11-18: this delete had no auth check at all; it only stayed closed because production had no service key. Now operator only,
// the same check as /api/demo-login. Nothing in the UI calls it.
const SMARTFLOW_CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey || !anon) {
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
  }

  const jar = await cookies()
  const ssr = createServerClient(supabaseUrl, anon, { cookies: { getAll: () => jar.getAll(), setAll: () => {} } })
  const { data: { user } } = await ssr.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: operator } = await supabase
    .from('clients').select('id').eq('email', user.email).eq('id', SMARTFLOW_CLIENT_ID).maybeSingle()
  if (!operator) return NextResponse.json({ error: 'operator only' }, { status: 403 })

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete lead error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
