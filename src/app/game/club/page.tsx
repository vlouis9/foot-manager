import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClubNav from './ClubNav'

export default async function ClubPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('*').eq('user_id', user.id).eq('is_bot', false).single()
  if (!club) redirect('/welcome')

  const activeTab = searchParams.tab ?? 'squad'

  const { data: players } = await supabase
    .from('club_players').select('*, player:players(*)').eq('club_id', club.id)

  // Stats pour chaque joueur
  const playerIds = players?.map(p => p.player_id) ?? []
  const { data: allStats } = playerIds.length
    ? await supabase.from('player_real_stats').select('*').in('player_id', playerIds)
    : { data: [] }

  const { data: upgrades } = await supabase
    .from('club_upgrades').select('*').eq('club_id', club.id)

  // Finances
  const { data: transactions } = await supabase
    .from('market').select('player_id, price, created_at').order('created_at', { ascending: false }).limit(20)

  // Inventaire - cartes XP non appliquées
  const { data: packs } = await supabase
    .from('card_packs').select('*').eq('club_id', club.id)
    .order('created_at', { ascending: false })

  return (
    <ClubNav
      club={club}
      players={players ?? []}
      allStats={allStats ?? []}
      upgrades={upgrades ?? []}
      packs={packs ?? []}
      activeTab={activeTab}
    />
  )
}
