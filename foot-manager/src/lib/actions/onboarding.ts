'use server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CLUB_CONFIGS } from '@/types'
import { revalidatePath } from 'next/cache'

// ─── Créer le club joueur et assigner les joueurs de base ─────
export async function createPlayerClub(clubName: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const config = CLUB_CONFIGS[clubName]
  if (!config) throw new Error('Club invalide')

  // 1. Créer le club
  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .insert({
      user_id: user.id,
      name: clubName,
      budget: config.initial_budget,
      wage_budget: Math.floor(config.initial_budget * 0.25),
      is_bot: false,
    })
    .select()
    .single()
  if (clubErr) throw clubErr

  // 2. Récupérer les joueurs du club réel depuis le bot
  const { data: botClub } = await supabase
    .from('clubs')
    .select('id')
    .eq('name', clubName)
    .eq('is_bot', true)
    .single()
  if (!botClub) throw new Error('Club bot introuvable')

  const { data: botPlayers } = await supabase
    .from('club_players')
    .select('player_id')
    .eq('club_id', botClub.id)
  if (!botPlayers?.length) throw new Error('Joueurs bot introuvables')

  // 3. Transférer les joueurs du bot vers le club joueur
  const playerIds = botPlayers.map(p => p.player_id)

  // Supprimer du bot
  await supabase
    .from('club_players')
    .delete()
    .eq('club_id', botClub.id)
    .in('player_id', playerIds)

  // Ajouter au club joueur
  const inserts = playerIds.map(pid => ({
    club_id: club.id,
    player_id: pid,
    xp: 0,
    level: 1,
  }))
  await supabase.from('club_players').insert(inserts)

  // 4. Créer les upgrades initiaux (niveau 0)
  await supabase.from('club_upgrades').insert([
    { club_id: club.id, type: 'offense_center',  level: 0 },
    { club_id: club.id, type: 'defense_center',  level: 0 },
    { club_id: club.id, type: 'tactical_room',   level: 0 },
    { club_id: club.id, type: 'academy',         level: 0 },
  ])

  // 5. Ajouter un match joueur vs premier bot disponible pour la journée 1
  const { data: otherBot } = await supabase
    .from('clubs')
    .select('id')
    .eq('is_bot', true)
    .neq('name', clubName)
    .limit(1)
    .single()

  if (otherBot) {
    await supabase.from('matches').insert({
      gameweek: 1,
      home_club_id: club.id,
      away_club_id: otherBot.id,
      processed: false,
    })
  }

  // 6. Mettre à jour l'onboarding state
  await supabase
    .from('onboarding_state')
    .upsert({ user_id: user.id, club_chosen: true })

  revalidatePath('/')
  return club
}

// ─── Tirer 25 cartes aléatoires ───────────────────────────────
export async function drawDraftCards(clubId: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // Joueurs déjà dans le club joueur (à exclure)
  const { data: myPlayers } = await supabase
    .from('club_players')
    .select('player_id')
    .eq('club_id', clubId)

  const myPlayerIds = myPlayers?.map(p => p.player_id) ?? []

  // Tirer 25 joueurs aléatoires disponibles dans les clubs bots
  const { data: available } = await supabase
    .from('club_players')
    .select('player_id, players(*)')
    .not('player_id', 'in', `(${myPlayerIds.join(',')})`)
    .limit(200)

  if (!available?.length) throw new Error('Pas assez de joueurs disponibles')

  // Mélange et sélection de 25
  const shuffled = available.sort(() => Math.random() - 0.5).slice(0, 25)
  return shuffled.map(cp => cp.players) as any[]
}

// ─── Échanger un joueur (garder une carte draft) ──────────────
export async function exchangePlayer(
  myClubId: string,
  keptPlayerId: string,
  givenPlayerId: string
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // Vérifier unicité : le joueur à garder n'est dans aucun club joueur
  const { data: existing } = await supabase
    .from('club_players')
    .select('club_id, clubs(is_bot)')
    .eq('player_id', keptPlayerId)
    .single()

  if (existing && !(existing.clubs as any)?.is_bot) {
    throw new Error('Ce joueur appartient déjà à un club joueur')
  }

  // Récupérer le club d'origine du joueur à garder (pour lui renvoyer le joueur cédé)
  const { data: keptPlayer } = await supabase
    .from('players')
    .select('real_team')
    .eq('id', keptPlayerId)
    .single()

  const { data: originBot } = await supabase
    .from('clubs')
    .select('id')
    .eq('name', keptPlayer?.real_team)
    .eq('is_bot', true)
    .single()

  // Transaction : supprimer les deux entrées puis recréer
  await supabase.from('club_players').delete().eq('player_id', keptPlayerId)
  await supabase.from('club_players').delete().eq('player_id', givenPlayerId)

  // Ajouter le joueur gardé au club joueur
  await supabase.from('club_players').insert({
    club_id: myClubId,
    player_id: keptPlayerId,
    xp: 0,
    level: 1,
  })

  // Renvoyer le joueur cédé au bot d'origine
  if (originBot) {
    await supabase.from('club_players').insert({
      club_id: originBot.id,
      player_id: givenPlayerId,
      xp: 0,
      level: 1,
    })
  }

  return { success: true }
}

// ─── Finaliser le draft ───────────────────────────────────────
export async function finalizeDraft(userId: string) {
  const supabase = createServerSupabaseClient()
  await supabase
    .from('onboarding_state')
    .upsert({ user_id: userId, draft_done: true })
  revalidatePath('/')
}
