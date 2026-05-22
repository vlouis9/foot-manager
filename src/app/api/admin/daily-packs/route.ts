import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createServerSupabaseClient()
  const { data: clubs } = await supabase
    .from('clubs').select('id').eq('is_bot', false)

  if (!clubs?.length) return NextResponse.json({ message: '0 paquets ajoutés' })

  const inserts = clubs.map(c => ({ club_id: c.id, type: 'standard', opened: false }))
  await supabase.from('card_packs').insert(inserts)

  return NextResponse.json({ message: `✅ ${inserts.length} paquet(s) standard ajouté(s)` })
}
