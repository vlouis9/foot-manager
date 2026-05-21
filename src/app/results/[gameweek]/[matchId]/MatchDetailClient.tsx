'use client'
import { useState } from 'react'
import Link from 'next/link'
import { cn, formatMoney } from '@/lib/utils'
import { ChevronLeft, Star } from 'lucide-react'

interface Props {
  match: any
  homePlayers: any[]
  awayPlayers: any[]
  myClubId: string | null
  gameweek: number
}

const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 }
const POS_COLORS: Record<string, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40',
  DEF: 'text-blue-300 bg-blue-900/40',
  MID: 'text-green-300 bg-green-900/40',
  ATT: 'text-red-300 bg-red-900/40',
}

function computePlayerScore(player: any, stats: any): number {
  if (!stats || stats.minutes === 0) return 0
  let score = stats.rating ?? 5
  score += (stats.goals ?? 0) * 3
  score += (stats.assists ?? 0) * 1.5
  if (stats.clean_sheet && (player.position === 'GK' || player.position === 'DEF')) score += 1
  if (stats.yellow_card) score -= 0.5
  if (stats.red_card) score -= 2
  score += player.level * 0.1
  return Math.max(0, score)
}

function RatingDot({ rating }: { rating: number }) {
  const color =
    rating >= 7 ? 'text-grass' :
    rating >= 6 ? 'text-trophy' :
    rating >= 5 ? 'text-gray-300' : 'text-red-400'
  return <span className={cn('font-display font-bold text-base', color)}>{rating.toFixed(1)}</span>
}

function PlayerRow({ cp, isStarter }: { cp: any; isStarter: boolean }) {
  const p = cp.player
  const s = cp.stats
  const score = computePlayerScore(p, s)
  const played = s?.minutes > 0

  return (
    <div className={cn(
      'flex items-center gap-3 py-2.5 border-b border-card-border last:border-0',
      !played && 'opacity-40'
    )}>
      {/* Position */}
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-bold text-xs',
        POS_COLORS[p.position])}>
        {p.position}
      </div>

      {/* Nom */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-white text-sm truncate">{p.lastname}</span>
          {!isStarter && <span className="text-gray-600 text-xs font-body">(R)</span>}
        </div>
        {s && played && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gray-500 text-xs font-body">{s.minutes}'</span>
            {s.goals > 0 && <span className="text-xs">⚽ ×{s.goals}</span>}
            {s.assists > 0 && <span className="text-xs">🎯 ×{s.assists}</span>}
            {s.yellow_card && <span className="text-xs">🟨</span>}
            {s.red_card && <span className="text-xs">🟥</span>}
            {s.clean_sheet && (p.position === 'GK' || p.position === 'DEF') && (
              <span className="text-xs">🧤</span>
            )}
          </div>
        )}
      </div>

      {/* Stats droite */}
      <div className="text-right flex-shrink-0">
        {played && s ? (
          <>
            <RatingDot rating={s.rating} />
            <p className="text-grass text-xs font-display font-bold">{score.toFixed(1)} pts</p>
          </>
        ) : (
          <span className="text-gray-600 text-xs font-body">N/P</span>
        )}
      </div>
    </div>
  )
}

function TeamPanel({ club, players, score, isHome, isMyClub }: {
  club: any; players: any[]; score: number | null; isHome: boolean; isMyClub: boolean
}) {
  const sorted = [...players].sort((a, b) => {
    if (a.starter !== b.starter) return a.starter ? -1 : 1
    return (POS_ORDER[a.player.position] ?? 4) - (POS_ORDER[b.player.position] ?? 4)
  })

  const totalScore = players.reduce((sum, cp) => sum + computePlayerScore(cp.player, cp.stats), 0)
  const goals = score != null ? Math.round(score / 10) : '–'

  return (
    <div>
      {/* Header équipe */}
      <div className={cn(
        'player-card mb-3 text-center py-4',
        isMyClub ? 'border-grass/30 bg-grass/5' : ''
      )}>
        <p className={cn('font-display font-bold text-xl', isMyClub ? 'text-grass' : 'text-white')}>
          {club.name}
        </p>
        <p className="font-display font-bold text-5xl text-white mt-2">{goals}</p>
        <div className="flex items-center justify-center gap-3 mt-2">
          <span className="text-gray-400 text-xs font-body">{totalScore.toFixed(1)} pts fantôme</span>
          {isMyClub && <span className="text-grass text-xs font-body">★ Mon club</span>}
        </div>
      </div>

      {/* Liste joueurs */}
      <div className="player-card">
        <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-2">
          Titulaires ({players.filter(p => p.starter).length})
        </p>
        {sorted.filter(cp => cp.starter).map(cp => (
          <PlayerRow key={cp.id} cp={cp} isStarter={true} />
        ))}

        {sorted.filter(cp => !cp.starter).length > 0 && (
          <>
            <p className="text-gray-600 text-xs font-body uppercase tracking-widest mt-4 mb-2">
              Remplaçants
            </p>
            {sorted.filter(cp => !cp.starter).map(cp => (
              <PlayerRow key={cp.id} cp={cp} isStarter={false} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default function MatchDetailClient({
  match, homePlayers, awayPlayers, myClubId, gameweek
}: Props) {
  const [activeTab, setActiveTab] = useState<'home' | 'away'>(
    match.home_club.id === myClubId ? 'home' : 'away'
  )

  const hGoals = match.home_score != null ? Math.round(match.home_score / 10) : '–'
  const aGoals = match.away_score != null ? Math.round(match.away_score / 10) : '–'

  let result: 'home' | 'away' | 'draw' | null = null
  if (match.processed && match.home_score != null) {
    if (match.home_score > match.away_score) result = 'home'
    else if (match.home_score < match.away_score) result = 'away'
    else result = 'draw'
  }

  return (
    <div className="page max-w-lg mx-auto">
      {/* Back */}
      <div className="flex items-center gap-3 pt-2 mb-4">
        <Link href={`/results/${gameweek}`} className="text-gray-400 font-body text-sm flex items-center gap-1">
          <ChevronLeft size={16} />J{gameweek}
        </Link>
      </div>

      {/* Scoreboard */}
      <div className="player-card mb-4 py-5">
        <div className="flex items-center justify-around">
          <div className="text-center flex-1">
            <p className={cn('font-display font-bold text-lg leading-tight',
              match.home_club.id === myClubId ? 'text-grass' : 'text-white')}>
              {match.home_club.name}
            </p>
            {result === 'home' && <span className="text-xs text-grass font-body">Victoire</span>}
          </div>
          <div className="text-center px-4">
            {match.processed ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-5xl text-white">{hGoals}</span>
                  <span className="text-gray-600 font-body text-2xl">–</span>
                  <span className="font-display font-bold text-5xl text-white">{aGoals}</span>
                </div>
                <p className="text-gray-500 text-xs font-body mt-1">Journée {gameweek}</p>
              </>
            ) : (
              <div className="text-center">
                <span className="text-gray-500 font-body text-sm">À venir</span>
              </div>
            )}
          </div>
          <div className="text-center flex-1">
            <p className={cn('font-display font-bold text-lg leading-tight',
              match.away_club.id === myClubId ? 'text-grass' : 'text-white')}>
              {match.away_club.name}
            </p>
            {result === 'away' && <span className="text-xs text-grass font-body">Victoire</span>}
          </div>
        </div>

        {/* Scores fantômes */}
        {match.processed && (
          <div className="flex items-center justify-around mt-3 pt-3 border-t border-card-border">
            <span className="text-gray-500 text-xs font-body">
              {match.home_score?.toFixed(1)} pts
            </span>
            <span className="text-gray-600 text-xs font-body uppercase tracking-widest">Score fantôme</span>
            <span className="text-gray-500 text-xs font-body">
              {match.away_score?.toFixed(1)} pts
            </span>
          </div>
        )}
      </div>

      {/* Tabs équipes */}
      <div className="flex bg-card border border-card-border rounded-xl p-1 mb-4">
        <button
          onClick={() => setActiveTab('home')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-display font-bold truncate transition-all',
            activeTab === 'home' ? 'bg-grass text-pitch' : 'text-gray-400')}>
          {match.home_club.name}
        </button>
        <button
          onClick={() => setActiveTab('away')}
          className={cn('flex-1 py-2 rounded-lg text-sm font-display font-bold truncate transition-all',
            activeTab === 'away' ? 'bg-grass text-pitch' : 'text-gray-400')}>
          {match.away_club.name}
        </button>
      </div>

      {/* Panel équipe */}
      {activeTab === 'home' ? (
        <TeamPanel
          club={match.home_club}
          players={homePlayers}
          score={match.home_score}
          isHome={true}
          isMyClub={match.home_club.id === myClubId}
        />
      ) : (
        <TeamPanel
          club={match.away_club}
          players={awayPlayers}
          score={match.away_score}
          isHome={false}
          isMyClub={match.away_club.id === myClubId}
        />
      )}
    </div>
  )
}
