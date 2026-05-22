import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: state } = await supabase
    .from('onboarding_state')
    .select('simulated_date')
    .eq('user_id', user.id)
    .single()

  const current = state?.simulated_date ? new Date(state.simulated_date) : new Date()
  current.setDate(current.getDate() + 1)

  await supabase
    .from('onboarding_state')
    .update({ simulated_date: current.toISOString() })
    .eq('user_id', user.id)

  // Ajouter un paquet standard quotidien
  const { data: club } = await supabase
    .from('clubs').select('id').eq('user_id', user.id).eq('is_bot', false).single()

  if (club) {
    await supabase.from('card_packs').insert({
      club_id: club.id, type: 'standard', opened: false
    })
  }

  return NextResponse.json({ date: current.toISOString() })
}
