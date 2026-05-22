import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createServerSupabaseClient()
  await supabase.from('calendar').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  return NextResponse.json({ message: '✅ Calendrier réinitialisé' })
}
