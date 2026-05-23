import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { saveId } = await req.json()

  // Désactiver toutes les saves
  await supabase.from('game_saves')
    .update({ is_active: false })
    .eq('user_id', user.id)

  // Activer la save choisie
  const { data: save } = await supabase
    .from('game_saves')
    .update({ is_active: true, last_played: new Date().toISOString() })
    .eq('id', saveId)
    .eq('user_id', user.id)
    .select('club_id, gameweek')
    .single()

  if (!save) return NextResponse.json({ error: 'Save introuvable' }, { status: 404 })

  // Synchroniser l'onboarding state
  await supabase.from('onboarding_state').upsert({
    user_id: user.id,
    draft_done: true,
    current_gameweek: save.gameweek,
    save_id: saveId,
  }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
