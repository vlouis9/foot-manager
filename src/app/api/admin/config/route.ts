import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.from('game_config').select('key, value, label, category')
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const configs = await req.json()

  const updates = Object.entries(configs).map(([key, value]) => ({
    key,
    value: JSON.stringify(value),
    label: key,
    category: 'general',
  }))

  const { error } = await supabase
    .from('game_config')
    .upsert(updates, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: '✅ Configuration sauvegardée' })
}
