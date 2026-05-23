'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Club, ClubPlayer, ClubUpgrade, Player, CardPack } from '@/types'
import { cn, formatMoney } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Star, TrendingUp, Zap, Shield, Brain, GraduationCap, Home, Users, ChevronRight, X } from 'lucide-react'

type CPWithPlayer = ClubPlayer & { player: Player }
type ExtUpgrade = ClubUpgrade & { type: string }

const TABS = [
  { id: 'squad',   label: 'Effectif'    },
  { id: 'infra',   label: 'Infras'      },
  { id: 'finance', label: 'Finances'    },
  { id: 'inventory', label: 'Inventaire' },
]

// ── Agrégation stats ──────────────────────────────────────────
function aggStats(stats: any[], playerId: string) {
  const ps = stats.filter(s => s.player_id === playerId)
  if (!ps.length) return null
  const played = ps.filter(s => s.minutes > 0)
  return {
    played:    played.length,
    total:     ps.length,
    avgRating: played.length ? played.reduce((s, p) => s + p.rating, 0) / played.length : 0,
    goals:     ps.reduce((s, p) => s + p.goals, 0),
    assists:   ps.reduce((s, p) => s + p.assists, 0),
    titPct:    ps.length ? Math.round((played.length / ps.length) * 100) : 0,
  }
}

// ── Onglet Effectif ───────────────────────────────────────────
function SquadTab({ players, stats, onSelectPlayer }: { players: CPWithPlayer[]; stats: any[]; onSelectPlayer: (cp: CPWithPlayer) => void }) {
  const [filter, setFilter] = useState<string>('ALL')
  const byPos = ['ALL', 'GK', 'DEF', 'MID', 'ATT']
  const POS_COLORS: Record<string, string> = {
    GK: 'text-yellow-300 bg-yellow-900/40', DEF: 'text-blue-300 bg-blue-900/40',
    MID: 'text-green-300 bg-green-900/40',  ATT: 'text-red-300 bg-red-900/40',
  }

  const filtered = players
    .filter(cp => filter === 'ALL' || cp.player.position === filter)
    .sort((a, b) => b.player.market_value - a.player.market_value)

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {byPos.map(pos => (
          <button key={pos} onClick={() => setFilter(pos)}
            className={cn('flex-shrink-0 px-3 py-1 rounded-lg text-xs font-display font-bold uppercase',
              filter === pos ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
            {pos === 'ALL' ? `Tous (${players.length})` : pos}
          </button>
        ))}
      </div>
      {filtered.map(cp => {
        const s = aggStats(stats, cp.player_id)
        return (
          <button key={cp.id} onClick={() => onSelectPlayer(cp)} className="player-card w-full text-left flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs', POS_COLORS[cp.player.position])}>
              {cp.player.position}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-display font-bold text-white truncate">{cp.player.lastname}</span>
                <span className="text-trophy text-xs font-display font-bold">Niv.{cp.level}</span>
              </div>
              {s && s.played > 0 ? (
                <div className="flex items-center gap-2 text-xs font-body text-gray-500">
                  <span className={cn(s.avgRating >= 7 ? 'text-grass' : s.avgRating >= 5.5 ? 'text-trophy' : 'text-red-400', 'font-bold')}>
                    {s.avgRating.toFixed(1)}
                  </span>
                  <span>{s.titPct}% tit.</span>
                  {s.goals > 0 && <span>⚽{s.goals}</span>}
                  {s.assists > 0 && <span>🎯{s.assists}</span>}
                </div>
              ) : (
                <span className="text-gray-600 text-xs font-body">Aucun match</span>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-grass text-sm font-body">{formatMoney(cp.player.market_value)}</p>
              <p className="text-gray-600 text-xs font-body">{formatMoney(cp.player.salary)}/sem</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Fiche joueur (drawer) ─────────────────────────────────────
function PlayerSheet({ cp, stats, onClose, onApplyXp }: {
  cp: CPWithPlayer; stats: any; onClose: () => void
  onApplyXp: (cpId: string, amount: number) => void
}) {
  const p = cp.player
  const s = aggStats(stats, cp.player_id)
  const xpNeeded = 100 * cp.level
  const pct = Math.min(100, Math.round((cp.xp / xpNeeded) * 100))

  return (
    <div className="fixed inset-0 z-50 bg-pitch/95 flex flex-col animate-slide-up overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border sticky top-0 bg-pitch">
        <button onClick={onClose} className="text-gray-400 font-body text-sm">← Retour</button>
        <span className="text-gray-500 text-xs font-body">{p.real_team}</span>
      </div>
      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto w-full">
        <div className="text-center">
          <p className="font-display font-bold text-4xl text-white">{p.lastname}</p>
          <p className="text-gray-400 font-body text-sm mt-1">{p.position} · {p.age} ans</p>
        </div>
        {/* Stats */}
        {s && s.played > 0 && (
          <div className="player-card">
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3">Stats ({s.played} matchs)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Note moy.', value: s.avgRating.toFixed(1), highlight: s.avgRating >= 7 },
                { label: '% Titulaire', value: `${s.titPct}%`, highlight: false },
                { label: 'Buts', value: String(s.goals), highlight: s.goals > 0 },
                { label: 'Passes déc.', value: String(s.assists), highlight: s.assists > 0 },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="bg-pitch border border-card-border rounded-xl p-3 text-center">
                  <p className="text-gray-500 text-xs font-body mb-1">{label}</p>
                  <p className={cn('font-display font-bold text-xl', highlight ? 'text-grass' : 'text-white')}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* XP */}
        <div className="player-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-trophy" />
              <span className="text-gray-300 text-sm font-body">Niveau {cp.level}</span>
            </div>
            <span className="text-trophy font-display font-bold">{pct}%</span>
          </div>
          <div className="w-full bg-card-border rounded-full h-2 mb-2">
            <div className="bg-trophy h-2 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-gray-600 text-xs font-body">{cp.xp} / {xpNeeded} XP — Bonus score : +{(cp.level * 0.1).toFixed(1)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="player-card text-center">
            <p className="text-gray-500 text-xs font-body mb-1">Valeur</p>
            <p className="font-display font-bold text-white text-lg">{formatMoney(p.market_value)}</p>
          </div>
          <div className="player-card text-center">
            <p className="text-gray-500 text-xs font-body mb-1">Salaire</p>
            <p className="font-display font-bold text-white text-lg">{formatMoney(p.salary)}/sem</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Onglet Infrastructures ────────────────────────────────────
const INFRA_INFO: Record<string, { label: string; icon: any; effects: string[]; maxLevel: number }> = {
  offense_center:  { label: 'Centre Offensif',   icon: Zap,          maxLevel: 5, effects: ['','+0.15 ATT/MID','+0.30','+0.45','+0.60','+0.75'] },
  defense_center:  { label: 'Centre Défensif',   icon: Shield,       maxLevel: 5, effects: ['','+0.15 GK/DEF','+0.30','+0.45','+0.60','+0.75'] },
  tactical_room:   { label: 'Salle Tactique',    icon: Brain,        maxLevel: 5, effects: ['','+0.20 collectif','+0.40','+0.60','+0.80','+1.00'] },
  academy:         { label: 'Académie',          icon: GraduationCap,maxLevel: 3, effects: ['','XP×1.25','XP×1.50','XP×2.00'] },
  training_center: { label: 'Centre Entraîn.',   icon: Users,        maxLevel: 5, effects: ['','+2XP/j','+4XP/j','+6XP/j','+8XP/j','+12XP/j'] },
  stadium:         { label: 'Stade',             icon: Home,         maxLevel: 5, effects: ['','+10k€/vic','+20k€','+30k€','+50k€','+80k€'] },
  tactical_staff:  { label: 'Staff Tactique',    icon: Brain,        maxLevel: 5, effects: ['','+0.20 équipe','+0.40','+0.60','+0.80','+1.00'] },
}

function InfraTab({ club, upgrades }: { club: Club; upgrades: ExtUpgrade[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [budget, setBudget] = useState(club.budget)
  const [levels, setLevels] = useState<Record<string, number>>(
    () => Object.fromEntries(upgrades.map(u => [u.type, u.level]))
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const cost = (lvl: number) => 200_000 * Math.pow(2, lvl)

  async function upgrade(type: string) {
    const info = INFRA_INFO[type]
    const lvl = levels[type] ?? 0
    if (lvl >= info.maxLevel) return
    const c = cost(lvl)
    if (budget < c) { setToast('Budget insuffisant'); setTimeout(() => setToast(''), 2000); return }
    setLoading(type)
    await supabase.from('club_upgrades').upsert({ club_id: club.id, type, level: lvl + 1 }, { onConflict: 'club_id,type' })
    await supabase.from('clubs').update({ budget: budget - c }).eq('id', club.id)
    setBudget(b => b - c)
    setLevels(l => ({ ...l, [type]: lvl + 1 }))
    setToast(`✅ ${info.label} → Niv.${lvl + 1}`)
    setTimeout(() => setToast(''), 2000)
    setLoading(null)
  }

  return (
    <div className="space-y-3">
      {toast && <div className="toast">{toast}</div>}
      <div className="player-card mb-2 flex items-center justify-between">
        <span className="text-gray-400 text-sm font-body">Budget</span>
        <span className="font-display font-bold text-grass text-lg">{formatMoney(budget)}</span>
      </div>
      {Object.entries(INFRA_INFO).map(([type, info]) => {
        const lvl = levels[type] ?? 0
        const isMax = lvl >= info.maxLevel
        const canAfford = budget >= cost(lvl)
        const Icon = info.icon
        return (
          <div key={type} className="player-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-grass/10 border border-grass/20 flex items-center justify-center">
                <Icon size={16} className="text-grass" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold text-white text-sm">{info.label}</p>
                  <span className="text-trophy text-xs font-display font-bold">{lvl}/{info.maxLevel}</span>
                </div>
                <div className="flex gap-0.5 mt-1">
                  {Array.from({ length: info.maxLevel }).map((_, i) => (
                    <div key={i} className={cn('flex-1 h-1 rounded-full', i < lvl ? 'bg-grass' : 'bg-card-border')} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs font-body">
                {lvl > 0 ? info.effects[lvl] : 'Non amélioré'}
                {!isMax && ` → ${info.effects[lvl + 1]}`}
              </span>
              {isMax ? (
                <span className="text-grass text-xs font-body">✅ Max</span>
              ) : (
                <button onClick={() => upgrade(type)} disabled={!canAfford || loading === type}
                  className={cn('px-3 py-1 rounded-xl text-xs font-display font-bold transition-all',
                    canAfford ? 'bg-grass text-pitch' : 'bg-card-border text-gray-600 cursor-not-allowed')}>
                  {loading === type ? '...' : formatMoney(cost(lvl))}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Onglet Finances ───────────────────────────────────────────
function FinanceTab({ club, players }: { club: Club; players: CPWithPlayer[] }) {
  const totalSalary = players.reduce((s, cp) => s + cp.player.salary, 0)
  const weeksOfCoverage = totalSalary > 0 ? Math.floor(club.budget / totalSalary) : 999

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Budget disponible', value: formatMoney(club.budget), color: 'text-grass' },
          { label: 'Masse salariale/sem', value: formatMoney(totalSalary), color: 'text-trophy' },
          { label: 'Couverture salariale', value: `${weeksOfCoverage} sem.`, color: weeksOfCoverage > 10 ? 'text-grass' : 'text-red-400' },
          { label: 'Réputation', value: `${club.reputation}/100`, color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="player-card text-center">
            <p className="text-gray-500 text-xs font-body mb-1">{label}</p>
            <p className={cn('font-display font-bold text-xl', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Top salaires */}
      <div className="player-card">
        <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3">Top salaires</p>
        {players
          .sort((a, b) => b.player.salary - a.player.salary)
          .slice(0, 8)
          .map(cp => (
            <div key={cp.id} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
              <span className="font-body text-white text-sm">{cp.player.lastname}</span>
              <span className="text-trophy font-body text-sm">{formatMoney(cp.player.salary)}/sem</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Onglet Inventaire ─────────────────────────────────────────
function InventoryTab({ packs, club }: { packs: CardPack[]; club: Club }) {
  const router = useRouter()
  const unopened = packs.filter(p => !p.opened)
  const byType = {
    prestige: unopened.filter(p => p.type === 'prestige'),
    journee:  unopened.filter(p => p.type === 'journee'),
    standard: unopened.filter(p => p.type === 'standard'),
  }
  const PACK_INFO = {
    prestige: { icon: '🏆', label: 'Prestige', color: 'border-trophy/50' },
    journee:  { icon: '⚽', label: 'Journée',  color: 'border-grass/50' },
    standard: { icon: '📦', label: 'Standard', color: 'border-gray-600' },
  }

  return (
    <div className="space-y-4">
      <div className="player-card bg-grass/5 border-grass/20">
        <p className="text-grass text-xs font-body">
          📦 {unopened.length} paquet{unopened.length !== 1 ? 's' : ''} à ouvrir — clique sur l'icône en haut à droite pour les ouvrir avec animation
        </p>
      </div>

      {(Object.entries(byType) as [keyof typeof byType, CardPack[]][]).map(([type, items]) => {
        if (!items.length) return null
        const info = PACK_INFO[type]
        return (
          <div key={type}>
            <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-2">
              {info.label} ({items.length})
            </p>
            <div className={cn('player-card', info.color)}>
              <div className="flex items-center gap-4">
                <span className="text-3xl">{info.icon}</span>
                <div className="flex-1">
                  <p className="font-display font-bold text-white">{items.length} paquet{items.length > 1 ? 's' : ''}</p>
                  <p className="text-gray-500 text-xs font-body">
                    {type === 'prestige' ? '10 cartes XP + chance rare' :
                     type === 'journee'  ? '5 cartes XP + 1 événement' :
                                          '3 cartes XP aléatoires'}
                  </p>
                </div>
                <button
                  onClick={() => router.push('/game/club?tab=inventory&open=true')}
                  className="btn-primary py-2 px-4 text-sm"
                >
                  Ouvrir
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {unopened.length === 0 && (
        <div className="text-center py-10">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 font-body">Aucun paquet en attente</p>
          <p className="text-gray-600 text-xs font-body mt-1">Un paquet standard est ajouté chaque jour</p>
        </div>
      )}
    </div>
  )
}

// ── Navigation principale ─────────────────────────────────────
interface Props {
  club: Club
  players: CPWithPlayer[]
  allStats: any[]
  upgrades: ExtUpgrade[]
  packs: CardPack[]
  activeTab: string
}

export default function ClubNav({ club, players, allStats, upgrades, packs, activeTab }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState(activeTab)
  const [selectedPlayer, setSelectedPlayer] = useState<CPWithPlayer | null>(null)

  return (
    <div className="max-w-lg mx-auto">
      {selectedPlayer && (
        <PlayerSheet
          cp={selectedPlayer}
          stats={allStats}
          onClose={() => setSelectedPlayer(null)}
          onApplyXp={() => {}}
        />
      )}

      {/* Sub-tabs */}
      <div className="flex border-b border-card-border bg-pitch sticky top-24 z-30">
        {TABS.map(t => (
          <button key={t.id} onClick={() => {
            setTab(t.id)
            router.replace(`/game/club?tab=${t.id}`, { scroll: false })
          }}
            className={cn(
              'flex-1 py-3 text-xs font-display font-bold uppercase tracking-wide transition-all border-b-2',
              tab === t.id ? 'text-grass border-grass' : 'text-gray-500 border-transparent'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {tab === 'squad'     && <SquadTab players={players} stats={allStats} onSelectPlayer={setSelectedPlayer} />}
        {tab === 'infra'     && <InfraTab club={club} upgrades={upgrades as any} />}
        {tab === 'finance'   && <FinanceTab club={club} players={players} />}
        {tab === 'inventory' && <InventoryTab packs={packs} club={club} />}
      </div>
    </div>
  )
}
