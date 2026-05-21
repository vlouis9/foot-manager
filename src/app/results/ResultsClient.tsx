'use client'
import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronRight, Clock, CheckCircle } from 'lucide-react'

interface MatchData {
  id: string
  gameweek: number
  processed: boolean
  home_score: number | null
  away_score: number | null
  home_club: { id: string; name: string; is_bot: boolean }
  away_club: { id: string; name: string; is_bot: boolean }
}

interface Props {
  matches: MatchData[]
  myClubId: string | null
  currentGameweek: number
}

function MatchRow({ match, myClubId }: { match: MatchData; myClubId: string | null }) {
  const isMyMatch = match.home_club.id === myClubId || match.away_club.id === myClubId
  const homeGoals = match.home_score != null ? Math.round(match.home_score / 10) : null
  const awayGoals = match.away_score != null ? Math.round(match.away_score / 10) : null

  let resultColor = ''
  if (match.processed && myClubId) {
    const myScore = match.home_club.id === myClubId ? match.home_score : match.away_score
    const oppScore = match.home_club.id === myClubId ? match.away_score : match.home_score
    if (myScore != null && oppScore != null) {
      if (myScore > oppScore) resultColor = 'border-l-2 border-l-grass'
      else if (myScore < oppScore) resultColor = 'border-l-2 border-l-red-600'
      else resultColor = 'border-l-2 border-l-trophy'
    }
  }

  return (
    <Link href={`/results/${match.gameweek}/${match.id}`}>
      <div className={cn(
        'player-card flex items-center gap-3 mb-2 transition-all active:scale-98',
        isMyMatch && resultColor
      )}>
        {/* Clubs */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              'font-display font-bold text-sm truncate',
              isMyMatch && match.home_club.id === myClubId ? 'text-grass' : 'text-white'
            )}>
              {match.home_club.name}
            </span>

            {/* Score */}
            {match.processed ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-display font-bold text-white text-lg">
                  {homeGoals}
                </span>
                <span className="text-gray-600 font-body text-sm">–</span>
                <span className="font-display font-bold text-white text-lg">
                  {awayGoals}
                </span>
              </div>
            ) : (
              <span className="text-gray-600 font-body text-xs px-2">vs</span>
            )}

            <span className={cn(
              'font-display font-bold text-sm truncate text-right',
              isMyMatch && match.away_club.id === myClubId ? 'text-grass' : 'text-white'
            )}>
              {match.away_club.name}
            </span>
          </div>

          {/* Scores fantômes */}
          {match.processed && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-600 text-xs font-body">
                {match.home_score?.toFixed(1)} pts
              </span>
              <span className="text-gray-600 text-xs font-body">
                {match.away_score?.toFixed(1)} pts
              </span>
            </div>
          )}
        </div>

        <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
      </div>
    </Link>
  )
}

export default function ResultsClient({ matches, myClubId, currentGameweek }: Props) {
  const [selectedGw, setSelectedGw] = useState<number | null>(null)

  // Grouper par journée
  const gameweeks = Array.from(new Set(matches.map(m => m.gameweek))).sort((a, b) => b - a)
  const processedGws = new Set(
    matches.filter(m => m.processed).map(m => m.gameweek)
  )

  const activeGw = selectedGw ?? (gameweeks[0] ?? 1)
  const gwMatches = matches.filter(m => m.gameweek === activeGw)

  // Stats de la journée sélectionnée pour mon club
  const myMatch = gwMatches.find(
    m => m.home_club.id === myClubId || m.away_club.id === myClubId
  )
  const myScore = myMatch
    ? (myMatch.home_club.id === myClubId ? myMatch.home_score : myMatch.away_score)
    : null
  const oppScore = myMatch
    ? (myMatch.home_club.id === myClubId ? myMatch.away_score : myMatch.home_score)
    : null
  const myResult = myScore != null && oppScore != null
    ? myScore > oppScore ? 'V' : myScore < oppScore ? 'D' : 'N'
    : null

  return (
    <div className="page max-w-lg mx-auto">
      <div className="pt-2 mb-4">
        <h1 className="section-title mb-1">Résultats</h1>
        <p className="text-gray-500 text-sm font-body">
          {processedGws.size} journée{processedGws.size > 1 ? 's' : ''} jouée{processedGws.size > 1 ? 's' : ''}
        </p>
      </div>

      {/* Sélecteur journée */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {gameweeks.map(gw => (
          <button
            key={gw}
            onClick={() => setSelectedGw(gw)}
            className={cn(
              'flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all',
              'border font-display font-bold text-sm',
              activeGw === gw
                ? 'bg-grass text-pitch border-grass'
                : processedGws.has(gw)
                  ? 'bg-card border-card-border text-white'
                  : 'bg-card border-card-border text-gray-500'
            )}
          >
            <span>J{gw}</span>
            {processedGws.has(gw)
              ? <CheckCircle size={10} className="mt-0.5 text-current opacity-70" />
              : <Clock size={10} className="mt-0.5 text-current opacity-50" />
            }
          </button>
        ))}
      </div>

      {/* Résumé mon match */}
      {myMatch && myMatch.processed && myResult && (
        <div className={cn(
          'player-card mb-4 text-center py-4',
          myResult === 'V' ? 'border-grass/40 bg-grass/5' :
          myResult === 'D' ? 'border-red-700/40 bg-red-900/5' :
          'border-trophy/40 bg-trophy/5'
        )}>
          <p className="text-gray-400 text-xs font-body uppercase tracking-widest mb-2">Mon résultat</p>
          <div className="flex items-center justify-around">
            <div>
              <p className={cn('font-display font-bold text-lg',
                myMatch.home_club.id === myClubId ? 'text-grass' : 'text-white')}>
                {myMatch.home_club.name}
              </p>
              <p className="font-display font-bold text-4xl text-white mt-1">
                {Math.round((myMatch.home_score ?? 0) / 10)}
              </p>
            </div>
            <div className="text-center">
              <span className={cn(
                'font-display font-bold text-2xl',
                myResult === 'V' ? 'text-grass' :
                myResult === 'D' ? 'text-red-400' : 'text-trophy'
              )}>
                {myResult === 'V' ? '🏆' : myResult === 'D' ? '❌' : '🤝'}
              </span>
              <p className={cn(
                'font-display font-bold text-sm mt-1',
                myResult === 'V' ? 'text-grass' :
                myResult === 'D' ? 'text-red-400' : 'text-trophy'
              )}>
                {myResult === 'V' ? 'Victoire' : myResult === 'D' ? 'Défaite' : 'Nul'}
              </p>
            </div>
            <div>
              <p className={cn('font-display font-bold text-lg',
                myMatch.away_club.id === myClubId ? 'text-grass' : 'text-white')}>
                {myMatch.away_club.name}
              </p>
              <p className="font-display font-bold text-4xl text-white mt-1">
                {Math.round((myMatch.away_score ?? 0) / 10)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tous les matchs de la journée */}
      <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-3">
        Journée {activeGw} · {gwMatches.length} matchs
      </p>

      {gwMatches.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-body">Aucun match pour cette journée</p>
        </div>
      ) : (
        gwMatches.map(m => (
          <MatchRow key={m.id} match={m} myClubId={myClubId} />
        ))
      )}
    </div>
  )
}
