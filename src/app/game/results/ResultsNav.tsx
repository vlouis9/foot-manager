'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, ChevronRight } from 'lucide-react'

interface Props {
  myClubId: string
  matches: any[]
  allClubs: any[]
  activeGw: number
  currentGw: number
  tab: string
}

function normalizeClub(c: any) {
  return Array.isArray(c) ? c[0] : c
}

// ── Calcul classement ─────────────────────────────────────────
function computeStandings(clubs: any[], matches: any[]) {
  const rows: Record<string, any> = {}
  for (const c of clubs) {
    rows[c.id] = {
      club_id: c.id, name: c.name, is_bot: c.is_bot,
      played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, points: 0,
    }
  }
  for (const m of matches) {
    if (!m.processed) continue
    const hc = normalizeClub(m.home_club)
    const ac = normalizeClub(m.away_club)
    const h = rows[hc?.id]
    const a = rows[ac?.id]
    if (!h || !a) continue
    const hg = Math.round(m.home_score / 10)
    const ag = Math.round(m.away_score / 10)
    h.played++; a.played++
    h.goals_for += hg; h.goals_against += ag
    a.goals_for += ag; a.goals_against += hg
    if (hg > ag)      { h.won++; h.points += 3; a.lost++ }
    else if (hg < ag) { a.won++; a.points += 3; h.lost++ }
    else              { h.drawn++; h.points++; a.drawn++; a.points++ }
  }
  return Object.values(rows).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against)
  })
}

// ── Onglet Classement ─────────────────────────────────────────
function StandingsTab({ clubs, matches, myClubId }: { clubs: any[]; matches: any[]; myClubId: string }) {
  const rows = useMemo(() => computeStandings(clubs, matches), [clubs, matches])
  const myRank = rows.findIndex(r => r.club_id === myClubId) + 1

  return (
    <div>
      {myRank > 0 && (
        <p className="text-gray-400 text-sm font-body mb-4">
          Tu es <span className="text-grass font-bold">{myRank}e</span> sur {rows.length}
        </p>
      )}
      {/* Header */}
      <div className="grid grid-cols-12 gap-1 px-3 mb-2 text-xs font-display font-bold uppercase tracking-widest text-gray-600">
        <span className="col-span-1">#</span>
        <span className="col-span-5">Club</span>
        <span className="col-span-1 text-center">J</span>
        <span className="col-span-1 text-center">V</span>
        <span className="col-span-1 text-center">N</span>
        <span className="col-span-1 text-center">D</span>
        <span className="col-span-2 text-center">Pts</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const rank = i + 1
          const isMe = row.club_id === myClubId
          const zoneColor =
            rank <= 3 ? 'border-l-2 border-l-trophy' :
            rank <= 6 ? 'border-l-2 border-l-grass' :
            rank >= rows.length - 2 ? 'border-l-2 border-l-red-700' : ''

          return (
            <div key={row.club_id}
              className={cn(
                'grid grid-cols-12 gap-1 items-center px-3 py-2.5 rounded-xl',
                isMe ? 'bg-grass/10 border border-grass/30' : 'bg-card border border-card-border',
                zoneColor
              )}>
              <span className={cn('col-span-1 font-display font-bold text-sm',
                rank === 1 ? 'text-trophy' : rank <= 3 ? 'text-grass' : 'text-gray-500')}>
                {rank === 1 ? '🏆' : rank}
              </span>
              <div className="col-span-5 flex items-center gap-1 min-w-0">
                <span className={cn('font-display font-bold text-sm truncate',
                  isMe ? 'text-grass' : 'text-white')}>
                  {row.name}
                </span>
                {isMe && <span className="text-grass text-xs">★</span>}
              </div>
              <span className="col-span-1 text-center text-gray-400 text-sm">{row.played}</span>
              <span className="col-span-1 text-center text-grass text-sm">{row.won}</span>
              <span className="col-span-1 text-center text-trophy text-sm">{row.drawn}</span>
              <span className="col-span-1 text-center text-red-400 text-sm">{row.lost}</span>
              <span className={cn('col-span-2 text-center font-display font-bold text-base',
                isMe ? 'text-grass' : 'text-white')}>
                {row.points}
              </span>
            </div>
          )
        })}
      </div>
      {/* Légende */}
      <div className="mt-4 space-y-1">
        {[
          { color: 'bg-trophy', label: 'Podium' },
          { color: 'bg-grass',  label: 'Europe' },
          { color: 'bg-red-700', label: 'Relégation' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-sm', color)} />
            <span className="text-gray-500 text-xs font-body">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Ligne de match ────────────────────────────────────────────
function MatchRow({ match, myClubId }: { match: any; myClubId: string }) {
  const hc = normalizeClub(match.home_club)
  const ac = normalizeClub(match.away_club)
  const isMyMatch = hc?.id === myClubId || ac?.id === myClubId
  const hGoals = match.home_score != null ? Math.round(match.home_score / 10) : null
  const aGoals = match.away_score != null ? Math.round(match.away_score / 10) : null

  let resultColor = ''
  if (match.processed && isMyMatch) {
    const mine = hc?.id === myClubId ? match.home_score : match.away_score
    const opp  = hc?.id === myClubId ? match.away_score : match.home_score
    if (mine > opp)      resultColor = 'border-l-2 border-l-grass'
    else if (mine < opp) resultColor = 'border-l-2 border-l-red-600'
    else                 resultColor = 'border-l-2 border-l-trophy'
  }

  return (
    <Link href={`/game/results/${match.gameweek}/${match.id}`}>
      <div className={cn('player-card flex items-center gap-2 mb-2', isMyMatch && resultColor)}>
        <span className={cn('font-display font-bold text-sm flex-1 truncate',
          isMyMatch && hc?.id === myClubId ? 'text-grass' : 'text-white')}>
          {hc?.name}
        </span>
        {match.processed && hGoals != null ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="font-display font-bold text-white text-lg">{hGoals}</span>
            <span className="text-gray-600">–</span>
            <span className="font-display font-bold text-white text-lg">{aGoals}</span>
          </div>
        ) : (
          <span className="text-gray-600 text-xs font-body px-2">vs</span>
        )}
        <span className={cn('font-display font-bold text-sm flex-1 truncate text-right',
          isMyMatch && ac?.id === myClubId ? 'text-grass' : 'text-white')}>
          {ac?.name}
        </span>
        <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
      </div>
    </Link>
  )
}

// ── Onglet Résultats ──────────────────────────────────────────
function ResultsTab({ matches, myClubId, activeGw, onChangeGw }: {
  matches: any[]; myClubId: string; activeGw: number; onChangeGw: (gw: number) => void
}) {
  const gameweeks = useMemo(() =>
    Array.from(new Set(matches.map(m => m.gameweek))).sort((a, b) => b - a),
    [matches]
  )
  const processedGws = useMemo(() =>
    new Set(matches.filter(m => m.processed).map(m => m.gameweek)),
    [matches]
  )
  const gwMatches = matches.filter(m => m.gameweek === activeGw)
  const myMatch = gwMatches.find(m => {
    const hc = normalizeClub(m.home_club)
    const ac = normalizeClub(m.away_club)
    return hc?.id === myClubId || ac?.id === myClubId
  })

  let myResult: 'V' | 'N' | 'D' | null = null
  if (myMatch?.processed) {
    const hc = normalizeClub(myMatch.home_club)
    const mine = hc?.id === myClubId ? myMatch.home_score : myMatch.away_score
    const opp  = hc?.id === myClubId ? myMatch.away_score : myMatch.home_score
    myResult = mine > opp ? 'V' : mine < opp ? 'D' : 'N'
  }

  return (
    <div>
      {/* Sélecteur journée */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {gameweeks.map(gw => (
          <button key={gw} onClick={() => onChangeGw(gw)}
            className={cn(
              'flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border font-display font-bold text-sm transition-all',
              activeGw === gw
                ? 'bg-grass text-pitch border-grass'
                : processedGws.has(gw)
                  ? 'bg-card border-card-border text-white'
                  : 'bg-card border-card-border text-gray-500'
            )}>
            <span>J{gw}</span>
            {processedGws.has(gw)
              ? <CheckCircle size={10} className="mt-0.5 opacity-70" />
              : <Clock size={10} className="mt-0.5 opacity-40" />
            }
          </button>
        ))}
      </div>

      {/* Mon résultat */}
      {myMatch?.processed && myResult && (() => {
        const hc = normalizeClub(myMatch.home_club)
        const ac = normalizeClub(myMatch.away_club)
        return (
          <div className={cn('player-card mb-4 py-4 text-center',
            myResult === 'V' ? 'border-grass/40 bg-grass/5' :
            myResult === 'D' ? 'border-red-700/40 bg-red-900/5' : 'border-trophy/40 bg-trophy/5')}>
            <p className="text-gray-400 text-xs font-body uppercase tracking-widest mb-3">Mon résultat · J{activeGw}</p>
            <div className="flex items-center justify-around">
              <div>
                <p className={cn('font-display font-bold text-lg', hc?.id === myClubId ? 'text-grass' : 'text-white')}>
                  {hc?.name}
                </p>
                <p className="font-display font-bold text-5xl text-white mt-1">
                  {Math.round(myMatch.home_score / 10)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl">{myResult === 'V' ? '🏆' : myResult === 'D' ? '❌' : '🤝'}</p>
                <p className={cn('font-display font-bold text-base mt-1',
                  myResult === 'V' ? 'text-grass' : myResult === 'D' ? 'text-red-400' : 'text-trophy')}>
                  {myResult === 'V' ? 'Victoire' : myResult === 'D' ? 'Défaite' : 'Nul'}
                </p>
              </div>
              <div>
                <p className={cn('font-display font-bold text-lg', ac?.id === myClubId ? 'text-grass' : 'text-white')}>
                  {ac?.name}
                </p>
                <p className="font-display font-bold text-5xl text-white mt-1">
                  {Math.round(myMatch.away_score / 10)}
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tous les matchs */}
      <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-3">
        Journée {activeGw} · {gwMatches.length} matchs
      </p>
      {gwMatches.length === 0 ? (
        <div className="text-center py-10">
          <Clock size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-body">Aucun match pour cette journée</p>
        </div>
      ) : (
        gwMatches.map(m => <MatchRow key={m.id} match={m} myClubId={myClubId} />)
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────
export default function ResultsNav({ myClubId, matches, allClubs, activeGw, currentGw, tab }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(tab)
  const [gw, setGw] = useState(activeGw)

  function changeGw(newGw: number) {
    setGw(newGw)
    router.replace(`/game/results?tab=${activeTab}&gw=${newGw}`, { scroll: false })
  }

  function changeTab(t: string) {
    setActiveTab(t)
    router.replace(`/game/results?tab=${t}&gw=${gw}`, { scroll: false })
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Sub-tabs */}
      <div className="flex border-b border-card-border bg-pitch sticky top-24 z-30">
        {[
          { id: 'results',  label: 'Résultats'  },
          { id: 'standings', label: 'Classement' },
        ].map(t => (
          <button key={t.id} onClick={() => changeTab(t.id)}
            className={cn(
              'flex-1 py-3 text-xs font-display font-bold uppercase tracking-wide transition-all border-b-2',
              activeTab === t.id ? 'text-grass border-grass' : 'text-gray-500 border-transparent'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {activeTab === 'results' && (
          <ResultsTab
            matches={matches}
            myClubId={myClubId}
            activeGw={gw}
            onChangeGw={changeGw}
          />
        )}
        {activeTab === 'standings' && (
          <StandingsTab clubs={allClubs} matches={matches} myClubId={myClubId} />
        )}
      </div>
    </div>
  )
}
