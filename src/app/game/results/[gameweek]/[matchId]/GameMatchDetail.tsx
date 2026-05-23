'use client'
import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 }
const POS_LABEL: Record<string, string> = { GK: 'Gardiens', DEF: 'Défenseurs', MID: 'Milieux', ATT: 'Attaquants' }
const POS_COLORS: Record<string, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40',
  DEF: 'text-blue-300 bg-blue-900/40',
  MID: 'text-green-300 bg-green-900/40',
  ATT: 'text-red-300 bg-red-900/40',
}

function computeScore(player: any, stats: any): number {
  if (!stats || stats.minutes === 0) return 0
  let s = stats.rating ?? 5
  s += (stats.goals ?? 0) * 3
  s += (stats.assists ?? 0) * 1.5
  if (stats.clean_sheet && (player.position === 'GK' || player.position === 'DEF')) s += 1
  if (stats.yellow_card) s -= 0.5
  if (stats.red_card)    s -= 2
  s += (player.level ?? 1) * 0.1
  return Math.max(0, s)
}

function PlayerRow({ cp }: { cp: any }) {
  const p = cp.player
  const s = cp.stats
  const score = computeScore(p, s)
  const played = s?.minutes > 0

  return (
    <div className={cn('flex items-center gap-2 py-2 border-b border-card-border last:border-0', !played && 'opacity-40')}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-xs flex-shrink-0', POS_COLORS[p.position])}>
        {p.position}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-white text-sm truncate">{p.lastname}</span>
          {!cp.starter && <span className="text-gray-600 text-xs">(R)</span>}
        </div>
        {played && s && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-gray-500 text-xs">{s.minutes}'</span>
            {s.goals > 0 && <span className="text-xs">⚽×{s.goals}</span>}
            {s.assists > 0 && <span className="text-xs">🎯×{s.assists}</span>}
            {s.yellow_card && <span className="text-xs">🟨</span>}
            {s.red_card && <span className="text-xs">🟥</span>}
            {s.clean_sheet && (p.position === 'GK' || p.position === 'DEF') && <span className="text-xs">🧤</span>}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {played && s ? (
          <>
            <span className={cn('font-display font-bold text-base',
              s.rating >= 7 ? 'text-grass' : s.rating >= 5.5 ? 'text-trophy' : 'text-red-400')}>
              {s.rating?.toFixed(1)}
            </span>
            <p className="text-grass text-xs font-display font-bold">{score.toFixed(1)} pts</p>
          </>
        ) : (
          <span className="text-gray-600 text-xs">N/P</span>
        )}
      </div>
    </div>
  )
}

function TeamPanel({ club, players, score, isMyClub }: {
  club: any; players: any[]; score: number | null; isMyClub: boolean
}) {
  const goals = score != null ? Math.round(score / 10) : '–'
  const totalPts = players.reduce((sum, cp) => sum + computeScore(cp.player, cp.stats), 0)

  // Grouper par ligne
  const positions = ['GK', 'DEF', 'MID', 'ATT']
  const starters = players.filter(cp => cp.starter).sort(
    (a, b) => (POS_ORDER[a.player.position] ?? 4) - (POS_ORDER[b.player.position] ?? 4)
  )
  const bench = players.filter(cp => !cp.starter).sort(
    (a, b) => (POS_ORDER[a.player.position] ?? 4) - (POS_ORDER[b.player.position] ?? 4)
  )

  return (
    <div>
      <div className={cn('player-card text-center py-4 mb-3', isMyClub ? 'border-grass/30 bg-grass/5' : '')}>
        <p className={cn('font-display font-bold text-xl', isMyClub ? 'text-grass' : 'text-white')}>{club.name}</p>
        <p className="font-display font-bold text-5xl text-white mt-1">{goals}</p>
        <p className="text-gray-500 text-xs font-body mt-1">{totalPts.toFixed(1)} pts fantôme</p>
      </div>

      {/* Par ligne */}
      {positions.map(pos => {
        const group = starters.filter(cp => cp.player.position === pos)
        if (!group.length) return null
        return (
          <div key={pos} className="player-card mb-2">
            <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-1">
              {POS_LABEL[pos]}
            </p>
            {group.map((cp, i) => <PlayerRow key={i} cp={cp} />)}
          </div>
        )
      })}

      {bench.length > 0 && (
        <div className="player-card mb-2 opacity-70">
          <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-1">Remplaçants</p>
          {bench.map((cp, i) => <PlayerRow key={i} cp={cp} />)}
        </div>
      )}
    </div>
  )
}

interface Props {
  match: any
  homePlayers: any[]
  awayPlayers: any[]
  myClubId: string | null
  gameweek: number
}

export default function GameMatchDetail({ match, homePlayers, awayPlayers, myClubId, gameweek }: Props) {
  const [activeTab, setActiveTab] = useState<'home' | 'away'>(
    match.home_club.id === myClubId ? 'home' : 'away'
  )

  const hGoals = match.home_score != null ? Math.round(match.home_score / 10) : '–'
  const aGoals = match.away_score != null ? Math.round(match.away_score / 10) : '–'

  let result: 'home' | 'away' | 'draw' | null = null
  if (match.processed) {
    if (match.home_score > match.away_score) result = 'home'
    else if (match.home_score < match.away_score) result = 'away'
    else result = 'draw'
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-28">
      <div className="flex items-center gap-3 pt-2 mb-4">
        <Link href={`/game/results?gw=${gameweek}`} className="text-gray-400 font-body text-sm flex items-center gap-1">
          <ChevronLeft size={16} />J{gameweek}
        </Link>
      </div>

      {/* Scoreboard */}
      <div className="player-card mb-4 py-5">
        <div className="flex items-center justify-around">
          <div className="text-center flex-1">
            <p className={cn('font-display font-bold text-base leading-tight',
              match.home_club.id === myClubId ? 'text-grass' : 'text-white')}>
              {match.home_club.name}
            </p>
            {result === 'home' && <span className="text-xs text-grass font-body">Victoire</span>}
          </div>
          <div className="text-center px-3">
            {match.processed ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-5xl text-white">{hGoals}</span>
                  <span className="text-gray-600 text-2xl">–</span>
                  <span className="font-display font-bold text-5xl text-white">{aGoals}</span>
                </div>
                <p className="text-gray-600 text-xs font-body mt-1">J{gameweek}</p>
              </>
            ) : (
              <span className="text-gray-500 font-body">À venir</span>
            )}
          </div>
          <div className="text-center flex-1">
            <p className={cn('font-display font-bold text-base leading-tight',
              match.away_club.id === myClubId ? 'text-grass' : 'text-white')}>
              {match.away_club.name}
            </p>
            {result === 'away' && <span className="text-xs text-grass font-body">Victoire</span>}
          </div>
        </div>
        {match.processed && (
          <div className="flex justify-around mt-3 pt-3 border-t border-card-border">
            <span className="text-gray-500 text-xs font-body">{match.home_score?.toFixed(1)} pts</span>
            <span className="text-gray-600 text-xs font-body uppercase tracking-widest">Score fantôme</span>
            <span className="text-gray-500 text-xs font-body">{match.away_score?.toFixed(1)} pts</span>
          </div>
        )}
      </div>

      {/* Tabs équipes */}
      <div className="flex bg-card border border-card-border rounded-xl p-1 mb-4">
        <button onClick={() => setActiveTab('home')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-display font-bold truncate transition-all',
            activeTab === 'home' ? 'bg-grass text-pitch' : 'text-gray-400')}>
          {match.home_club.name}
        </button>
        <button onClick={() => setActiveTab('away')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-display font-bold truncate transition-all',
            activeTab === 'away' ? 'bg-grass text-pitch' : 'text-gray-400')}>
          {match.away_club.name}
        </button>
      </div>

      {activeTab === 'home' ? (
        <TeamPanel club={match.home_club} players={homePlayers} score={match.home_score}
          isMyClub={match.home_club.id === myClubId} />
      ) : (
        <TeamPanel club={match.away_club} players={awayPlayers} score={match.away_score}
          isMyClub={match.away_club.id === myClubId} />
      )}
    </div>
  )
}
