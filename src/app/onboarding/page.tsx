import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingDraft from './OnboardingDraft'

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!state) redirect('/welcome')
  if (state.draft_done) redirect('/game')

  // Club le plus récent du joueur
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, budget, wage_budget')
    .eq('user_id', user.id)
    .eq('is_bot', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!club) redirect('/welcome')

  // Vérifier/initialiser les joueurs du club
  const { count: playerCount } = await supabase
    .from('club_players')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', club.id)

  if (!playerCount || playerCount === 0) {
    const { data: botClub } = await supabase
      .from('clubs').select('id').eq('name', club.name).eq('is_bot', true).single()

    if (botClub) {
      const { data: botPlayers } = await supabase
        .from('club_players').select('player_id').eq('club_id', botClub.id)

      if (botPlayers?.length) {
        const ids = botPlayers.map((p: any) => p.player_id)
        await supabase.from('club_players').delete()
          .eq('club_id', botClub.id).in('player_id', ids)
        await supabase.from('club_players').insert(
          ids.map((pid: string) => ({ club_id: club.id, player_id: pid, xp: 0, level: 1 }))
        )
      }
    }
  }

  // Effectif actuel
  const { data: myPlayersRaw } = await supabase
    .from('club_players')
    .select('player_id, players(id, lastname, position, market_value, salary, real_team, category)')
    .eq('club_id', club.id)

  const myPlayers = (myPlayersRaw ?? [])
    .map((cp: any) => cp.players)
    .filter(Boolean)

  const myPlayerIds = myPlayers.map((p: any) => p.id)

  // Tirer 25 cartes par catégorie, SANS les joueurs du club choisi
  const DRAFT_CONFIG = [
    { category: 'bronze',  count: 10 },
    { category: 'argent',  count: 7  },
    { category: 'or',      count: 5  },
    { category: 'platine', count: 2  },
    { category: 'diamant', count: 1  },
  ]

  let draftCards: any[] = []
  for (const { category, count } of DRAFT_CONFIG) {
    // Exclure les joueurs du club choisi ET les joueurs déjà dans l'effectif
    const { data: pool } = await supabase
      .from('players')
      .select('id, lastname, position, market_value, salary, real_team, category')
      .eq('category', category)
      .neq('real_team', club.name) // pas de joueurs du même club
      .not('id', 'in', `(${myPlayerIds.join(',')})`)
      .limit(count * 15)

    if (pool?.length) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count)
      draftCards = [...draftCards, ...shuffled]
    }
  }

  // Masse salariale actuelle
  const currentWage = myPlayers.reduce((sum: number, p: any) => sum + (p.salary ?? 0), 0)

  return (
    <OnboardingDraft
      userId={user.id}
      club={{ ...club, current_wage: currentWage }}
      draftCards={draftCards}
      myPlayers={myPlayers}
    />
  )
}
