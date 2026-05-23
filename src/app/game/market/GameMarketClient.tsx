'use client'
import { useState, useMemo } from 'react'
import type { Club, ClubPlayer, Player, Position } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, X, ChevronRight, Clock, Zap, Filter } from 'lucide-react'

type CPWithPlayer = ClubPlayer & { player: Player }

const POS_COLORS: Record<string, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40',
  DEF: 'text-blue-300 bg-blue-900/40',
  MID: 'text-green-300 bg-green-900/40',
  ATT: 'text-red-300 bg-red-900/40',
}

const CLUBS_L1 = ['PSG','Monaco','Marseille','Lyon','Lille','Nice','Lens','Rennes',
  'Strasbourg','Nantes','Toulouse','Brest','Lorient','Le Havre','Auxerre','Angers','Paris FC','Metz']

function aggStats(stats: any[], playerId: string) {
  const ps = stats.filter(s => s.player_id === playerId)
  if (!ps.length) return null
  const played = ps.filter(s => s.minutes > 0)
  if (!played.length) return null
  return {
    played:    played.length,
    total:     ps.length,
    avgRating: played.reduce((s, p) => s + p.rating, 0) / played.length,
    goals:     ps.reduce((s, p) => s + p.goals, 0),
    assists:   ps.reduce((s, p) => s + p.assists, 0),
    titPct:    Math.round((played.length / ps.length) * 100),
    // Forme récente (3 derniers matchs)
    recentRating: played.slice(0, 3).reduce((s, p) => s + p.rating, 0) / Math.min(3, played.length),
  }
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expiré'
  const h = Math.floor(diff / 3_600_000)
  if (h >= 24) return `${Math.floor(h / 24)}j`
  return `${h}h`
}

// ── Fiche joueur détaillée ────────────────────────────────────
function PlayerSheet({ player, stats, offer, inMySquad, canAfford, onBuy, onClose }: {
  player: Player; stats: any; offer: any; inMySquad: boolean
  canAfford: boolean; onBuy: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-pitch/95 flex flex-col overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border sticky top-0 bg-pitch">
        <button onClick={onClose} className="text-gray-400 text-sm font-body">← Retour</button>
        <span className={cn('px-2 py-0.5 rounded-md font-display font-bold text-xs', POS_COLORS[player.position])}>
          {player.position}
        </span>
      </div>
      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto w-full">
        <div className="text-center">
          <p className="font-display font-bold text-4xl text-white">{player.lastname}</p>
          <p className="text-gray-400 font-body text-sm mt-1">{player.real_team} · {player.age} ans</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Valeur',   value: formatMoney(player.market_value), c: 'text-white' },
            { label: 'Salaire',  value: `${formatMoney(player.salary)}/sem`, c: 'text-trophy' },
          ].map(({ label, value, c }) => (
            <div key={label} className="player-card text-center">
              <p className="text-gray-500 text-xs font-body mb-1">{label}</p>
              <p className={cn('font-display font-bold text-lg', c)}>{value}</p>
            </div>
          ))}
        </div>

        {stats ? (
          <div className="player-card">
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3">
              Stats ({stats.played} matchs / {stats.total})
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: 'Note moy.',   value: stats.avgRating.toFixed(1),  highlight: stats.avgRating >= 7 },
                { label: 'Forme rég.',  value: stats.recentRating.toFixed(1), highlight: stats.recentRating >= 7 },
                { label: '% Titu.',     value: `${stats.titPct}%`,           highlight: stats.titPct >= 70 },
                { label: 'Buts',        value: String(stats.goals),          highlight: stats.goals > 3 },
                { label: 'Passes déc.', value: String(stats.assists),        highlight: stats.assists > 3 },
                { label: 'Matchs',      value: String(stats.played),         highlight: false },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="bg-pitch border border-card-border rounded-xl p-2.5 text-center">
                  <p className="text-gray-500 text-xs font-body mb-0.5">{label}</p>
                  <p className={cn('font-display font-bold text-lg', highlight ? 'text-grass' : 'text-white')}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {/* Barre note */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs font-body w-12">Note</span>
              <div className="flex-1 bg-card-border rounded-full h-2">
                <div className={cn('h-2 rounded-full',
                  stats.avgRating >= 7 ? 'bg-grass' : stats.avgRating >= 5.5 ? 'bg-trophy' : 'bg-red-500'
                )} style={{ width: `${(stats.avgRating / 10) * 100}%` }} />
              </div>
              <span className={cn('font-display font-bold text-sm w-8',
                stats.avgRating >= 7 ? 'text-grass' : stats.avgRating >= 5.5 ? 'text-trophy' : 'text-red-400')}>
                {stats.avgRating.toFixed(1)}
              </span>
            </div>
          </div>
        ) : (
          <div className="player-card text-center py-4 opacity-60">
            <p className="text-gray-500 font-body text-sm">Aucune stat disponible</p>
          </div>
        )}

        {/* Achat */}
        <div className="player-card">
          {inMySquad ? (
            <p className="text-grass font-display font-bold text-center py-2">✅ Dans ton effectif</p>
          ) : offer ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-gray-400 text-sm font-body">Prix transfert</p>
                  {offer.availability === 'opportunity' && (
                    <div className="flex items-center gap-1 text-trophy text-xs font-body">
                      <Zap size={10} />DEAL
                    </div>
                  )}
                </div>
                <p className={cn('font-display font-bold text-2xl',
                  offer.availability === 'opportunity' ? 'text-trophy' : 'text-white')}>
                  {formatMoney(offer.price)}
                </p>
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs font-body mb-3">
                <Clock size={11} /><span>Expire dans {timeLeft(offer.expires_at)}</span>
              </div>
              <button onClick={onBuy} disabled={!canAfford}
                className={cn('w-full py-3 rounded-xl font-display font-bold text-sm uppercase tracking-wide',
                  canAfford ? 'bg-grass text-pitch active:scale-95' : 'bg-card-border text-gray-600 cursor-not-allowed')}>
                {canAfford ? '+ Acheter' : 'Budget insuffisant'}
              </button>
            </>
          ) : (
            <p className="text-gray-500 font-body text-sm text-center py-2">
              Non disponible · {player.real_team}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Drawer filtres ────────────────────────────────────────────
function FiltersDrawer({
  filters, onChange, onClose
}: {
  filters: any; onChange: (f: any) => void; onClose: () => void
}) {
  const [local, setLocal] = useState(filters)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-pitch border-t border-card-border rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-card-border">
          <h3 className="font-display font-bold text-white text-lg">Filtres</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {/* Position */}
          <div>
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-2">Poste</p>
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'GK', 'DEF', 'MID', 'ATT'].map(pos => (
                <button key={pos} onClick={() => setLocal((f: any) => ({ ...f, position: pos }))}
                  className={cn('px-3 py-1.5 rounded-xl font-display font-bold text-xs uppercase',
                    local.position === pos ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                  {pos === 'ALL' ? 'Tous' : pos}
                </button>
              ))}
            </div>
          </div>

          {/* Club */}
          <div>
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-2">Club</p>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setLocal((f: any) => ({ ...f, club: 'ALL' }))}
                className={cn('px-2.5 py-1 rounded-lg font-display font-bold text-xs',
                  local.club === 'ALL' ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                Tous
              </button>
              {CLUBS_L1.map(c => (
                <button key={c} onClick={() => setLocal((f: any) => ({ ...f, club: c }))}
                  className={cn('px-2.5 py-1 rounded-lg font-display font-bold text-xs',
                    local.club === c ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Disponibilité */}
          <div>
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-2">Disponibilité</p>
            <div className="flex gap-2">
              {[
                { id: 'all',      label: 'Tous' },
                { id: 'market',   label: 'Sur le marché' },
                { id: 'deal',     label: '🔥 Deals' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setLocal((f: any) => ({ ...f, availability: id }))}
                  className={cn('flex-1 py-1.5 rounded-xl font-display font-bold text-xs uppercase',
                    local.availability === id ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tri */}
          <div>
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-2">Trier par</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'value',  label: 'Valeur' },
                { id: 'rating', label: 'Note moy.' },
                { id: 'form',   label: 'Forme' },
                { id: 'goals',  label: 'Buts' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setLocal((f: any) => ({ ...f, sortBy: id }))}
                  className={cn('px-3 py-1.5 rounded-xl font-display font-bold text-xs uppercase',
                    local.sortBy === id ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-4 pb-6 pt-2 border-t border-card-border">
          <button onClick={() => { onChange(local); onClose() }} className="btn-primary w-full">
            Appliquer
          </button>
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
}

export default function GameMarketClient({ club, allPlayers, allStats, myPlayers, marketOffers }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ position: 'ALL', club: 'ALL', availability: 'all', sortBy: 'value' })
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<Player | null>(null)
  const [budget, setBudget] = useState(club.budget)
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const offerMap = useMemo(() => new Map(marketOffers.map(o => [o.player_id, o])), [marketOffers])
  const mySquadIds = useMemo(() => new Set(myPlayers.map(cp => cp.player_id)), [myPlayers])
  const statsMap = useMemo(() => {
    const m = new Map<string, any>()
    for (const p of allPlayers) m.set(p.id, aggStats(allStats, p.id))
    return m
  }, [allPlayers, allStats])

  const filtered = useMemo(() => {
    let list = allPlayers.filter(p => {
      if (filters.position !== 'ALL' && p.position !== filters.position) return false
      if (filters.club !== 'ALL' && p.real_team !== filters.club) return false
      if (filters.availability === 'market' && !offerMap.has(p.id)) return false
      if (filters.availability === 'deal' && offerMap.get(p.id)?.availability !== 'opportunity') return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.lastname.toLowerCase().includes(q) && !p.real_team.toLowerCase().includes(q)) return false
      }
      return true
    })
    const s = (p: Player) => statsMap.get(p.id)
    list.sort((a, b) => {
      if (filters.sortBy === 'value')  return b.market_value - a.market_value
      if (filters.sortBy === 'rating') return (s(b)?.avgRating ?? 0) - (s(a)?.avgRating ?? 0)
      if (filters.sortBy === 'form')   return (s(b)?.recentRating ?? 0) - (s(a)?.recentRating ?? 0)
      if (filters.sortBy === 'goals')  return (s(b)?.goals ?? 0) - (s(a)?.goals ?? 0)
      return 0
    })
    return list
  }, [allPlayers, filters, search, offerMap, statsMap])

  const activeFiltersCount = [
    filters.position !== 'ALL', filters.club !== 'ALL',
    filters.availability !== 'all', filters.sortBy !== 'value',
  ].filter(Boolean).length

  async function handleBuy(player: Player) {
    const offer = offerMap.get(player.id)
    if (!offer || offer.price > budget) return
    setLoading(player.id)
    try {
      await supabase.from('market').delete().eq('player_id', player.id)
      await supabase.from('club_players').delete().eq('player_id', player.id)
      await supabase.from('club_players').insert({ club_id: club.id, player_id: player.id, xp: 0, level: 1 })
      const nb = budget - offer.price
      await supabase.from('clubs').update({ budget: nb }).eq('id', club.id)
      setBudget(nb)
      showToast(`✅ ${player.lastname} rejoint ton club !`)
      setSelected(null)
      router.refresh()
    } catch { showToast('Erreur') }
    setLoading(null)
  }

  async function handleSell(cp: CPWithPlayer) {
    const sp = Math.floor(cp.player.market_value * 0.85)
    setLoading(cp.id)
    try {
      await supabase.from('club_players').delete().eq('id', cp.id)
      await supabase.from('market').insert({
        player_id: cp.player_id, price: cp.player.market_value, availability: 'available',
        expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      })
      const nb = budget + sp
      await supabase.from('clubs').update({ budget: nb }).eq('id', club.id)
      setBudget(nb)
      showToast(`💰 ${cp.player.lastname} vendu ${formatMoney(sp)}`)
      router.refresh()
    } catch { showToast('Erreur') }
    setLoading(null)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-28">
      {toast && <div className="toast">{toast}</div>}

      {selected && (
        <PlayerSheet
          player={selected}
          stats={statsMap.get(selected.id)}
          offer={offerMap.get(selected.id)}
          inMySquad={mySquadIds.has(selected.id)}
          canAfford={(offerMap.get(selected.id)?.price ?? Infinity) <= budget}
          onBuy={() => handleBuy(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {showFilters && (
        <FiltersDrawer filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
      )}

      {/* Header */}
      <div className="pt-2 mb-3 flex items-center justify-between">
        <div>
          <h1 className="section-title mb-0.5">Mercato</h1>
          <p className="text-grass font-body text-sm">{formatMoney(budget)}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs font-body">{allPlayers.length} joueurs</p>
          <p className="text-gray-600 text-xs font-body">{marketOffers.length} offres</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border border-card-border rounded-xl p-1 mb-3">
        {(['buy', 'sell'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all',
              tab === t ? 'bg-grass text-pitch' : 'text-gray-400')}>
            {t === 'buy' ? '🔍 Explorer' : '💰 Vendre'}
          </button>
        ))}
      </div>

      {tab === 'buy' ? (
        <>
          {/* Recherche + filtres */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Nom ou club..."
                className="w-full bg-card border border-card-border rounded-xl pl-9 pr-3 py-2.5 text-white font-body text-sm focus:outline-none focus:border-grass/60" />
            </div>
            <button onClick={() => setShowFilters(true)}
              className={cn('flex items-center gap-1.5 px-3 py-2.5 rounded-xl border font-display font-bold text-sm transition-all',
                activeFiltersCount > 0
                  ? 'bg-grass/10 border-grass/50 text-grass'
                  : 'bg-card border-card-border text-gray-400')}>
              <Filter size={15} />
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 bg-grass text-pitch text-xs rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          <p className="text-gray-600 text-xs font-body mb-3">
            {filtered.length} joueurs · {filtered.filter(p => offerMap.has(p.id)).length} disponibles
          </p>

          {/* Liste */}
          <div className="space-y-2">
            {filtered.slice(0, 60).map(player => {
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
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-display font-bold text-white text-sm truncate">{player.lastname}</span>
                      {inMySquad && <span className="text-grass text-xs">★</span>}
                      {offer?.availability === 'opportunity' && <span className="text-xs">🔥</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-body text-gray-500">
                      <span>{player.real_team}</span>
                      {s && (
                        <>
                          <span className={cn('font-bold',
                            s.avgRating >= 7 ? 'text-grass' : s.avgRating >= 5.5 ? 'text-trophy' : 'text-red-400')}>
                            {s.avgRating.toFixed(1)}
                          </span>
                          {s.goals > 0 && <span>⚽{s.goals}</span>}
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
                    <ChevronRight size={13} className="text-gray-600 ml-auto mt-0.5" />
                  </div>
                </button>
              )
            })}
            {filtered.length > 60 && (
              <p className="text-gray-600 text-xs font-body text-center py-2">
                +{filtered.length - 60} joueurs — affine les filtres
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-500 text-xs font-body mb-2">Vente = 85% de la valeur marchande</p>
          {myPlayers.sort((a, b) => b.player.market_value - a.player.market_value).map(cp => {
            const s = statsMap.get(cp.player_id)
            return (
              <div key={cp.id} className="player-card flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs', POS_COLORS[cp.player.position])}>
                  {cp.player.position}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-white truncate">{cp.player.lastname}</p>
                  <div className="flex items-center gap-2 text-xs font-body text-gray-500">
                    <span>{cp.player.real_team}</span>
                    {s && <span className={cn('font-bold', s.avgRating >= 7 ? 'text-grass' : s.avgRating >= 5.5 ? 'text-trophy' : 'text-red-400')}>
                      {s.avgRating.toFixed(1)}
                    </span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-grass font-body text-sm">{formatMoney(Math.floor(cp.player.market_value * 0.85))}</p>
                  <button onClick={() => handleSell(cp)} disabled={!!loading}
                    className="text-red-400 text-xs font-display font-bold mt-0.5">
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
