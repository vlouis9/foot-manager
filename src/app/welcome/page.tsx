import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WelcomeClient from './WelcomeClient'

export default async function WelcomePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Toutes les saves du joueur avec les infos du club
  const { data: saves } = await supabase
    .from('game_saves')
    .select('id, save_name, is_active, gameweek, last_played, club_id, clubs(name, budget, reputation)')
    .eq('user_id', user.id)
    .order('last_played', { ascending: false })

  const formattedSaves = (saves ?? []).map((s: any) => ({
    id: s.id,
    club_name: s.clubs?.name ?? s.save_name,
    budget:     s.clubs?.budget ?? 0,
    reputation: s.clubs?.reputation ?? 0,
    gameweek:   s.gameweek,
    last_played: s.last_played,
    is_active:  s.is_active,
  }))

  const activeSave = formattedSaves.find(s => s.is_active) ?? null

  return (
    <WelcomeClient
      user={{ id: user.id, email: user.email ?? '' }}
      saves={formattedSaves}
      activeSave={activeSave}
    />
  )
}
