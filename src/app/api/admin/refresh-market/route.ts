import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createServerSupabaseClient()

  // Supprimer les offres expirées
  await supabase.from('market').delete().lt('expires_at', new Date().toISOString())

  // Compter les offres restantes
  const { count: remaining } = await supabase
    .from('market').select('*', { count: 'exact', head: true })
    .gt('expires_at', new Date().toISOString())

  const needed = Math.max(0, 30 - (remaining ?? 0))
  if (needed === 0) return NextResponse.json({ message: '✅ Marché déjà complet' })

  // Joueurs disponibles (pas dans un club joueur, pas déjà sur le marché)
  const { data: marketPlayerIds } = await supabase
    .from('market').select('player_id').gt('expires_at', new Date().toISOString())

  const excludedIds = marketPlayerIds?.map(m => m.player_id) ?? []

  const { data: playerClubs } = await supabase
    .from('club_players')
    .select('player_id, clubs!inner(is_bot)')
    .eq('clubs.is_bot', false)

  const playerClubIds = playerClubs?.map(p => p.player_id) ?? []
  const allExcluded = [...new Set([...excludedIds, ...playerClubIds])]

  let query = supabase.from('players').select('id, market_value')
  if (allExcluded.length > 0) {
    query = query.not('id', 'in', `(${allExcluded.join(',')})`)
  }
  const { data: available } = await query.limit(needed * 3)

  if (!available?.length) return NextResponse.json({ message: '⚠️ Aucun joueur disponible' })

  const shuffled = available.sort(() => Math.random() - 0.5).slice(0, needed)
  const inserts = shuffled.map(p => ({
    player_id: p.id,
    price: Math.round(p.market_value * (1 + (Math.random() * 0.2 - 0.1))),
    availability: Math.random() < 0.1 ? 'opportunity' : p.market_value > 20_000_000 ? 'expensive' : 'available',
    expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
  }))

  await supabase.from('market').insert(inserts)
  return NextResponse.json({ message: `✅ ${inserts.length} joueurs ajoutés au marché` })
}
