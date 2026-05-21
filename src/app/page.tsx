import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Dashboard from './Dashboard'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  // Vérifier l'onboarding
  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!state?.draft_done) redirect('/onboarding')

  // Charger les données du club
  const { data: club } = await supabase
    .from('clubs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!club) redirect('/onboarding')

  // Classement rapide (top 5)
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('processed', true)
    .order('gameweek', { ascending: false })
    .limit(50)

  // Paquets en attente
  const { data: packs } = await supabase
    .from('card_packs')
    .select('*')
    .eq('club_id', club.id)
    .eq('opened', false)

  // Prochain match
  const { data: nextMatch } = await supabase
    .from('matches')
    .select('*, home_club:clubs!matches_home_club_id_fkey(name), away_club:clubs!matches_away_club_id_fkey(name)')
    .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`)
    .eq('processed', false)
    .order('gameweek', { ascending: true })
    .limit(1)
    .single()

  return (
    <Dashboard
      club={club}
      pendingPacks={packs?.length ?? 0}
      nextMatch={nextMatch}
      gameweek={state.current_gameweek ?? 1}
    />
  )
}
