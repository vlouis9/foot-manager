'use client'
import { useState } from 'react'
import type { ClubPlayer, ClubUpgrade, Player, Position } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { Star, TrendingUp } from 'lucide-react'

type CPWithPlayer = ClubPlayer & { player: Player }

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'ATT']
const POS_LABEL: Record<Position, string> = {
  GK: 'Gardiens', DEF: 'Défenseurs', MID: 'Milieux', ATT: 'Attaquants'
}
const POS_COLORS: Record<Position, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40',
  DEF: 'text-blue-300 bg-blue-900/40',
  MID: 'text-green-300 bg-green-900/40',
  ATT: 'text-red-300 bg-red-900/40',
}

function xpToNextLevel(level: number) { return 100 * level }

function LevelBadge({ level, xp }: { level: number; xp: number }) {
  const needed = xpToNextLevel(level)
  const pct = Math.min(100, Math.round((xp / needed) * 100))
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1 bg-trophy/20 px-2 py-0.5 rounded-lg">
        <Star size={11} className="text-trophy fill-trophy" />
        <span className="text-trophy font-display font-bold text-xs">Niv.{level}</span>
      </div>
      <div className="w-16 bg-card-border rounded-full h-1">
        <div className="bg-trophy h-1 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PlayerCard({ cp, onSelect }: { cp: CPWithPlayer; onSelect: () => void }) {
  const p = cp.player
  return (
    <button onClick={onSelect} className="player-card w-full text-left flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs', POS_COLORS[p.position as Position])}>
        {p.position}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-display font-bold text-white text-base truncate">{p.lastname}</span>
          {cp.level > 1 && <span className="text-trophy text-xs font-display font-bold">+{(cp.level * 0.1).toFixed(1)}</span>}
        </div>
        <LevelBadge level={cp.level} xp={cp.xp} />
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-grass font-body text-sm font-medium">{formatMoney(p.market_value)}</p>
        <p className="text-gray-600 text-xs font-body">{formatMoney(p.salary)}/sem</p>
      </div>
    </button>
  )
}

function PlayerDetail({ cp, onClose }: { cp: CPWithPlayer; onClose: () => void }) {
  const p = cp.player
  const needed = xpToNextLevel(cp.level)
  const pct = Math.min(100, Math.round((cp.xp / needed) * 100))
  return (
    <div className="fixed inset-0 z-50 bg-pitch/95 flex flex-col animate-slide-up">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border">
        <button onClick={onClose} className="text-gray-400 font-body text-sm">← Retour</button>
        <span className={cn('badge-pos', `badge-${p.position}`)}>{p.position}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="text-center mb-8">
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 font-display font-bold text-2xl', POS_COLORS[p.position as Position])}>
            {p.position}
          </div>
          <h2 className="font-display font-bold text-3xl text-white">{p.lastname}</h2>
          <p className="text-gray-400 font-body text-sm mt-1">{p.real_team} · {p.age} ans</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Valeur marchande', value: formatMoney(p.market_value) },
            { label: 'Salaire / sem.', value: formatMoney(p.salary) },
            { label: 'Niveau', value: String(cp.level) },
            { label: 'XP total', value: String(cp.xp) },
          ].map(({ label, value }) => (
            <div key={label} className="player-card text-center">
              <p className="text-gray-500 text-xs font-body mb-1">{label}</p>
              <p className="font-display font-bold text-white text-xl">{value}</p>
            </div>
          ))}
        </div>
        <div className="player-card mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-trophy" />
              <span className="text-gray-300 text-sm font-body font-medium">Vers Niv.{cp.level + 1}</span>
            </div>
            <span className="text-trophy font-display font-bold text-sm">{pct}%</span>
          </div>
          <div className="w-full bg-card-border rounded-full h-2">
            <div className="bg-trophy h-2 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-gray-600 text-xs font-body mt-2">{cp.xp} / {needed} XP</p>
        </div>
      </div>
    </div>
  )
}

interface Props {
  clubId: string
  initialPlayers: CPWithPlayer[]
  upgrades: ClubUpgrade[]
}

export default function SquadClient({ clubId, initialPlayers, upgrades }: Props) {
  const [filter, setFilter] = useState<Position | 'ALL'>('ALL')
  const [selected, setSelected] = useState<CPWithPlayer | null>(null)
  const [sortBy, setSortBy] = useState<'value' | 'level' | 'position'>('position')

  const filtered = initialPlayers
    .filter(cp => filter === 'ALL' || cp.player.position === filter)
    .sort((a, b) => {
      if (sortBy === 'value') return b.player.market_value - a.player.market_value
      if (sortBy === 'level') return b.level - a.level || b.xp - a.xp
      const order: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 }
      return (order[a.player.position] ?? 4) - (order[b.player.position] ?? 4)
    })

  const totalWages = initialPlayers.reduce((s, cp) => s + cp.player.salary, 0)
  const totalValue = initialPlayers.reduce((s, cp) => s + cp.player.market_value, 0)
  const byPos = POSITIONS.reduce((acc, pos) => {
    acc[pos] = initialPlayers.filter(cp => cp.player.position === pos).length
    return acc
  }, {} as Record<Position, number>)

  return (
    <div className="page max-w-lg mx-auto">
      {selected && <PlayerDetail cp={selected} onClose={() => setSelected(null)} />}
      <div className="pt-2 mb-4">
        <h1 className="section-title mb-1">Mon Effectif</h1>
        <p className="text-gray-500 text-sm font-body">
          {initialPlayers.length} joueurs · {formatMoney(totalWages)}/sem · Val. {formatMoney(totalValue)}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {POSITIONS.map(pos => (
          <div key={pos} className={cn('player-card text-center py-2 cursor-pointer transition-all', filter === pos && 'ring-1 ring-grass')}
            onClick={() => setFilter(filter === pos ? 'ALL' : pos)}>
            <p className={cn('font-display font-bold text-lg', POS_COLORS[pos].split(' ')[0])}>{byPos[pos]}</p>
            <p className="text-gray-500 text-xs font-body">{pos}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {(['ALL', ...POSITIONS] as const).map(pos => (
            <button key={pos} onClick={() => setFilter(pos)}
              className={cn('px-3 py-1 rounded-lg text-xs font-display font-bold uppercase transition-all',
                filter === pos ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
              {pos === 'ALL' ? 'Tous' : pos}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="bg-card border border-card-border text-gray-400 text-xs font-body rounded-lg px-2 py-1">
          <option value="position">Poste</option>
          <option value="value">Valeur</option>
          <option value="level">Niveau</option>
        </select>
      </div>
      <div className="space-y-2">
        {filter === 'ALL'
          ? POSITIONS.map(pos => {
              const group = filtered.filter(cp => cp.player.position === pos)
              if (!group.length) return null
              return (
                <div key={pos}>
                  <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-2 mt-4">
                    {POS_LABEL[pos]} ({group.length})
                  </p>
                  {group.map(cp => <div key={cp.id} className="mb-2"><PlayerCard cp={cp} onSelect={() => setSelected(cp)} /></div>)}
                </div>
              )
            })
          : filtered.map(cp => <PlayerCard key={cp.id} cp={cp} onSelect={() => setSelected(cp)} />)
        }
      </div>
    </div>
  )
}
