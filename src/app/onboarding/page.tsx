import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingDraft from './OnboardingDraft'

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Récupérer l'état onboarding
  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!state) redirect('/welcome')
  if (state.draft_done) redirect('/game')

  // Club du joueur (déjà créé par /api/game/new)
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, budget, wage_budget')
    .eq('user_id', user.id)
    .eq('is_bot', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!club) redirect('/welcome')

  // Si le club n'a pas encore ses joueurs, les affecter maintenant
  const { count: playerCount } = await supabase
    .from('club_players')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', club.id)

  if (!playerCount || playerCount === 0) {
    // Copier les joueurs du bot correspondant
    const { data: botClub } = await supabase
      .from('clubs')
      .select('id')
      .eq('name', club.name)
      .eq('is_bot', true)
      .single()

    if (botClub) {
      const { data: botPlayers } = await supabase
        .from('club_players')
        .select('player_id')
        .eq('club_id', botClub.id)

      if (botPlayers?.length) {
        const ids = botPlayers.map(p => p.player_id)
        await supabase.from('club_players').delete()
          .eq('club_id', botClub.id).in('player_id', ids)
        await supabase.from('club_players').insert(
          ids.map(pid => ({ club_id: club.id, player_id: pid, xp: 0, level: 1 }))
        )
      }
    }
  }

  // Effectif actuel du joueur
  const { data: myPlayers } = await supabase
    .from('club_players')
    .select('player_id, players(id, lastname, position, market_value, salary, real_team, category)')
    .eq('club_id', club.id)

  // Tirer les 25 cartes selon les catégories
  const myPlayerIds = myPlayers?.map(p => p.player_id) ?? []

  // Récupérer les joueurs disponibles par catégorie
  const DRAFT_CONFIG = [
    { category: 'bronze',  count: 10 },
    { category: 'argent',  count: 7  },
    { category: 'or',      count: 5  },
    { category: 'platine', count: 2  },
    { category: 'diamant', count: 1  },
  ]

  let draftCards: any[] = []
  for (const { category, count } of DRAFT_CONFIG) {
    const { data: pool } = await supabase
      .from('players')
      .select('id, lastname, position, market_value, salary, real_team, category')
      .eq('category', category)
      .not('id', 'in', `(${myPlayerIds.join(',')})`)
      .limit(count * 10) // pool large pour shuffler

    if (pool?.length) {
      const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count)
      draftCards = [...draftCards, ...shuffled]
    }
  }

  // Calcul masse salariale actuelle
  const { data: salaryData } = await supabase
    .from('club_players')
    .select('players(salary)')
    .eq('club_id', club.id)

  const currentWage = salaryData?.reduce((sum: number, cp: any) =>
    sum + (cp.players?.salary ?? 0), 0) ?? 0

  return (
    <OnboardingDraft
      userId={user.id}
      club={{ ...club, current_wage: currentWage }}
      draftCards={draftCards}
      myPlayers={(myPlayers ?? []).map((cp: any) => cp.players).filter(Boolean)}
    />
  )
}
