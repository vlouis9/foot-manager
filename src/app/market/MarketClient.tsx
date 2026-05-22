'use client'
import { useState, useMemo } from 'react'
import type { Club, ClubPlayer, Player, Position } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, ChevronRight, ChevronLeft, Star, TrendingUp, Clock, Zap } from 'lucide-react'

type CPWithPlayer = ClubPlayer & { player: Player }

const POS_COLORS: Record<string, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40',
  DEF: 'text-blue-300 bg-blue-900/40',
  MID: 'text-green-300 bg-green-900/40',
  ATT: 'text-red-300 bg-red-900/40',
}

function aggregateStats(stats: any[], playerId: string) {
  const ps = stats.filter(s => s.player_id === playerId)
  if (!ps.length) return null
  const played = ps.filter(s => s.minutes > 0)
  return {
    matches:   ps.length,
    played:    played.length,
    avgRating: played.length ? played.reduce((s, p) => s + p.rating, 0) / played.length : 0,
    goals:     ps.reduce((s, p) => s + p.goals, 0),
    assists:   ps.reduce((s, p) => s + p.assists, 0),
    titPct:    ps.length ? Math.round((played.length / ps.length) * 100) : 0,
  }
}

function RatingBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = value >= 7 ? 'bg-grass' : value >= 5.5 ? 'bg-trophy' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-card-border rounded-full h-1.5">
        <div className={cn('h-1.5 rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('font-display font-bold text-sm',
        value >= 7 ? 'text-grass' : value >= 5.5 ? 'text-trophy' : 'text-red-400')}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}

function PlayerDetailSheet({ player, stats, offer, inMySquad, onBuy, onClose, canAfford }: {
  player: Player; stats: any; offer: any; inMySquad: boolean
  onBuy: () => void; onClose: () => void; canAfford: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 bg-pitch/95 flex flex-col animate-slide-up overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border sticky top-0 bg-pitch z-10">
        <button onClick={onClose} className="text-gray-400 font-body text-sm flex items-center gap-1">
          <ChevronLeft size={16} />Retour
        </button>
        <span className={cn('px-2 py-0.5 rounded-md font-display font-bold text-xs', POS_COLORS[player.position])}>
          {player.position}
        </span>
      </div>

      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto w-full">
        {/* Header joueur */}
        <div className="text-center mb-2">
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-3 font-display font-bold text-2xl', POS_COLORS[player.position])}>
            {player.position}
          </div>
          <h2 className="font-display font-bold text-3xl text-white">{player.lastname}</h2>
          <p className="text-gray-400 font-body text-sm mt-1">{player.real_team} · {player.age} ans</p>
        </div>

        {/* Valeur & salaire */}
        <div className="grid grid-cols-2 gap-3">
          <div className="player-card text-center">
            <p className="text-gray-500 text-xs font-body mb-1">Valeur marchande</p>
            <p className="font-display font-bold text-white text-xl">{formatMoney(player.market_value)}</p>
          </div>
          <div className="player-card text-center">
            <p className="text-gray-500 text-xs font-body mb-1">Salaire / sem.</p>
            <p className="font-display font-bold text-white text-xl">{formatMoney(player.salary)}</p>
          </div>
        </div>

        {/* Stats agrégées */}
        {stats ? (
          <div className="player-card">
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3">
              Statistiques ({stats.played} matchs joués / {stats.matches})
            </p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-body text-gray-400 mb-1">
                  <span>Note moyenne</span>
                  <span>{stats.titPct}% tit.</span>
                </div>
                <RatingBar value={stats.avgRating} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: 'Buts', value: stats.goals, icon: '⚽' },
                  { label: 'Passes', value: stats.assists, icon: '🎯' },
                  { label: '% Tit.', value: `${stats.titPct}%`, icon: '📋' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-pitch rounded-xl p-2 text-center border border-card-border">
                    <p className="text-lg">{icon}</p>
                    <p className="font-display font-bold text-white text-lg">{value}</p>
                    <p className="text-gray-600 text-xs font-body">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="player-card opacity-60 text-center py-4">
            <p className="text-gray-500 font-body text-sm">Aucune stat disponible pour l'instant</p>
          </div>
        )}

        {/* Disponibilité & achat */}
        <div className="player-card">
          {inMySquad ? (
            <div className="text-center py-2">
              <p className="text-grass font-display font-bold">✅ Dans ton effectif</p>
            </div>
          ) : offer ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-gray-400 text-sm font-body">Prix de transfert</p>
                  {offer.availability === 'opportunity' && (
                    <div className="flex items-center gap-1 text-trophy text-xs font-body mt-0.5">
                      <Zap size={11} />DEAL — offre limitée
                    </div>
                  )}
                </div>
                <p className={cn('font-display font-bold text-2xl',
                  offer.availability === 'opportunity' ? 'text-trophy' : 'text-white')}>
                  {formatMoney(offer.price)}
                </p>
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs font-body mb-3">
                <Clock size={11} />
                <span>Expire dans {Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 3_600_000))}h</span>
              </div>
              <button onClick={onBuy} disabled={!canAfford}
                className={cn('w-full py-3 rounded-xl font-display font-bold text-sm uppercase tracking-wide transition-all',
                  canAfford ? 'bg-grass text-pitch active:scale-95' : 'bg-card-border text-gray-600 cursor-not-allowed')}>
                {canAfford ? '+ Acheter' : 'Budget insuffisant'}
              </button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-gray-500 font-body text-sm">Non disponible sur le marché</p>
              <p className="text-gray-600 text-xs font-body mt-1">Appartient à {player.real_team}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  club: Club
  allPlayers: Player[]
  allStats: any[]
  myPlayers: CPWithPlayer[]
  marketOffers: any[]
  allClubPlayers: any[]
}

export default function MarketClient({ club, allPlayers, allStats, myPlayers, marketOffers, allClubPlayers }: Props) {
  const [tab, setTab]             = useState<'explore' | 'sell'>('explore')
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<Position | 'ALL'>('ALL')
  const [sortBy, setSortBy]       = useState<'value' | 'rating' | 'goals'>('value')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [selected, setSelected]   = useState<Player | null>(null)
  const [budget, setBudget]       = useState(club.budget)
  const [loading, setLoading]     = useState<string | null>(null)
  const [toast, setToast]         = useState('')
  const router = useRouter()
  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // Maps utiles
  const offerMap = useMemo(() =>
    new Map(marketOffers.map(o => [o.player_id, o])), [marketOffers])
  const mySquadIds = useMemo(() =>
    new Set(myPlayers.map(cp => cp.player_id)), [myPlayers])
  const statsMap = useMemo(() => {
    const map = new Map<string, any>()
    for (const p of allPlayers) map.set(p.id, aggregateStats(allStats, p.id))
    return map
  }, [allPlayers, allStats])

  // Filtrage et tri
  const filteredPlayers = useMemo(() => {
    let list = allPlayers.filter(p => {
      if (filter !== 'ALL' && p.position !== filter) return false
      if (search && !p.lastname.toLowerCase().includes(search.toLowerCase()) &&
          !p.real_team.toLowerCase().includes(search.toLowerCase())) return false
      if (onlyAvailable && !offerMap.has(p.id) && !mySquadIds.has(p.id)) return false
      return true
    })
    const s = (p: Player) => statsMap.get(p.id)
    list.sort((a, b) => {
      if (sortBy === 'value')  return b.market_value - a.market_value
      if (sortBy === 'rating') return (s(b)?.avgRating ?? 0) - (s(a)?.avgRating ?? 0)
      if (sortBy === 'goals')  return (s(b)?.goals ?? 0) - (s(a)?.goals ?? 0)
      return 0
    })
    return list
  }, [allPlayers, filter, search, sortBy, onlyAvailable, offerMap, mySquadIds, statsMap])

  async function handleBuy(player: Player) {
    const offer = offerMap.get(player.id)
    if (!offer || offer.price > budget) return
    setLoading(player.id)
    try {
      await supabase.from('market').delete().eq('player_id', player.id)
      await supabase.from('club_players').delete().eq('player_id', player.id)
      await supabase.from('club_players').insert({ club_id: club.id, player_id: player.id, xp: 0, level: 1 })
      const newBudget = budget - offer.price
      await supabase.from('clubs').update({ budget: newBudget }).eq('id', club.id)
      setBudget(newBudget)
      showToast(`✅ ${player.lastname} rejoint ton club !`)
      setSelected(null)
      router.refresh()
    } catch { showToast('Erreur lors de l\'achat') }
    setLoading(null)
  }

  async function handleSell(cp: CPWithPlayer) {
    const sellPrice = Math.floor(cp.player.market_value * 0.85)
    setLoading(cp.id)
    try {
      await supabase.from('club_players').delete().eq('id', cp.id)
      await supabase.from('market').insert({
        player_id: cp.player_id, price: cp.player.market_value, availability: 'available',
        expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      })
      const newBudget = budget + sellPrice
      await supabase.from('clubs').update({ budget: newBudget }).eq('id', club.id)
      setBudget(newBudget)
      showToast(`💰 ${cp.player.lastname} vendu pour ${formatMoney(sellPrice)}`)
      router.refresh()
    } catch { showToast('Erreur lors de la vente') }
    setLoading(null)
  }

  return (
    <div className="page max-w-lg mx-auto">
      {toast && <div className="toast">{toast}</div>}

      {selected && (
        <PlayerDetailSheet
          player={selected}
          stats={statsMap.get(selected.id)}
          offer={offerMap.get(selected.id)}
          inMySquad={mySquadIds.has(selected.id)}
          canAfford={(offerMap.get(selected.id)?.price ?? Infinity) <= budget}
          onBuy={() => handleBuy(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Header */}
      <div className="pt-2 mb-4 flex items-center justify-between">
        <div>
          <h1 className="section-title mb-0.5">Mercato</h1>
          <p className="text-grass font-body text-sm">{formatMoney(budget)}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs font-body">{allPlayers.length} joueurs</p>
          <p className="text-gray-600 text-xs font-body">{marketOffers.length} offres actives</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border border-card-border rounded-xl p-1 mb-4">
        {(['explore', 'sell'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all',
              tab === t ? 'bg-grass text-pitch' : 'text-gray-400')}>
            {t === 'explore' ? '🔍 Explorer' : '💰 Vendre'}
          </button>
        ))}
      </div>

      {tab === 'explore' ? (
        <>
          {/* Recherche */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un joueur ou club..."
              className="w-full bg-card border border-card-border rounded-xl pl-9 pr-4 py-3 text-white font-body text-sm focus:outline-none focus:border-grass/60"
            />
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            {(['ALL', 'GK', 'DEF', 'MID', 'ATT'] as const).map(pos => (
              <button key={pos} onClick={() => setFilter(pos)}
                className={cn('flex-shrink-0 px-3 py-1 rounded-lg text-xs font-display font-bold uppercase transition-all',
                  filter === pos ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                {pos === 'ALL' ? 'Tous' : pos}
              </button>
            ))}
          </div>

          {/* Options tri */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnlyAvailable(v => !v)}
                className={cn('px-3 py-1 rounded-lg text-xs font-display font-bold uppercase transition-all',
                  onlyAvailable ? 'bg-trophy text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                Disponibles
              </button>
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="bg-card border border-card-border text-gray-400 text-xs font-body rounded-lg px-2 py-1">
              <option value="value">Valeur</option>
              <option value="rating">Note moy.</option>
              <option value="goals">Buts</option>
            </select>
          </div>

          {/* Liste joueurs */}
          <div className="space-y-2">
            {filteredPlayers.slice(0, 50).map(player => {
              const offer = offerMap.get(player.id)
              const inMySquad = mySquadIds.has(player.id)
              const s = statsMap.get(player.id)

              return (
                <button key={player.id} onClick={() => setSelected(player)}
                  className="player-card w-full text-left flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs', POS_COLORS[player.position])}>
                    {player.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-bold text-white truncate">{player.lastname}</span>
                      {inMySquad && <span className="text-grass text-xs">★</span>}
                      {offer?.availability === 'opportunity' && <span className="text-trophy text-xs">🔥</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs font-body">{player.real_team}</span>
                      {s && s.played > 0 && (
                        <>
                          <span className={cn('text-xs font-display font-bold',
                            s.avgRating >= 7 ? 'text-grass' : s.avgRating >= 5.5 ? 'text-trophy' : 'text-red-400')}>
                            {s.avgRating.toFixed(1)}
                          </span>
                          {s.goals > 0 && <span className="text-xs text-gray-500">⚽{s.goals}</span>}
                          {s.assists > 0 && <span className="text-xs text-gray-500">🎯{s.assists}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {offer ? (
                      <p className={cn('font-display font-bold text-sm',
                        offer.availability === 'opportunity' ? 'text-trophy' : 'text-grass')}>
                        {formatMoney(offer.price)}
                      </p>
                    ) : (
                      <p className="text-gray-600 text-xs font-body">{formatMoney(player.market_value)}</p>
                    )}
                    <ChevronRight size={14} className="text-gray-600 ml-auto mt-0.5" />
                  </div>
                </button>
              )
            })}
            {filteredPlayers.length > 50 && (
              <p className="text-gray-600 text-xs font-body text-center py-2">
                {filteredPlayers.length - 50} joueurs supplémentaires — affine ta recherche
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-500 text-xs font-body mb-3">
            Prix de vente = 85% de la valeur marchande
          </p>
          {myPlayers
            .filter(cp => filter === 'ALL' || cp.player.position === filter)
            .sort((a, b) => b.player.market_value - a.player.market_value)
            .map(cp => {
              const s = statsMap.get(cp.player_id)
              return (
                <div key={cp.id} className="player-card flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs', POS_COLORS[cp.player.position])}>
                    {cp.player.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-white truncate">{cp.player.lastname}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs font-body">{cp.player.real_team}</span>
                      {s && s.played > 0 && (
                        <span className={cn('text-xs font-display font-bold',
                          s.avgRating >= 7 ? 'text-grass' : s.avgRating >= 5.5 ? 'text-trophy' : 'text-red-400')}>
                          {s.avgRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-grass font-body text-sm">{formatMoney(Math.floor(cp.player.market_value * 0.85))}</p>
                    <button onClick={() => handleSell(cp)} disabled={!!loading}
                      className="text-red-400 text-xs font-display font-bold mt-0.5 hover:text-red-300">
                      Vendre
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
