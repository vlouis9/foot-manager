'use client'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Trophy } from 'lucide-react'

interface Club { id: string; name: string; is_bot: boolean }
interface Match {
  id: string; gameweek: number
  home_club_id: string; away_club_id: string
  home_score: number; away_score: number
  processed: boolean
}

interface Row {
  club_id: string; name: string; is_player: boolean
  played: number; won: number; drawn: number; lost: number
  goals_for: number; goals_against: number; points: number
}

interface Props {
  clubs: Club[]
  matches: Match[]
  myClubId: string | null
}

function computeStandings(clubs: Club[], matches: Match[]): Row[] {
  const rows: Record<string, Row> = {}
  for (const c of clubs) {
    rows[c.id] = {
      club_id: c.id, name: c.name, is_player: !c.is_bot,
      played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, points: 0,
    }
  }
  for (const m of matches) {
    if (!m.processed) continue
    const h = rows[m.home_club_id]
    const a = rows[m.away_club_id]
    if (!h || !a) continue
    const hg = Math.round(m.home_score)
    const ag = Math.round(m.away_score)
    h.played++; a.played++
    h.goals_for += hg; h.goals_against += ag
    a.goals_for += ag; a.goals_against += hg
    if (hg > ag) { h.won++; h.points += 3; a.lost++ }
    else if (hg < ag) { a.won++; a.points += 3; h.lost++ }
    else { h.drawn++; h.points++; a.drawn++; a.points++ }
  }
  return Object.values(rows).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdB = b.goals_for - b.goals_against
    const gdA = a.goals_for - a.goals_against
    if (gdB !== gdA) return gdB - gdA
    return b.goals_for - a.goals_for
  })
}

export default function StandingsClient({ clubs, matches, myClubId }: Props) {
  const rows = useMemo(() => computeStandings(clubs, matches), [clubs, matches])
  const myRank = rows.findIndex(r => r.club_id === myClubId) + 1

  return (
    <div className="page max-w-lg mx-auto">
      <div className="pt-2 mb-6">
        <h1 className="section-title mb-1">Classement</h1>
        {myRank > 0 && (
          <p className="text-gray-400 text-sm font-body">
            Tu es <span className="text-grass font-bold">{myRank}e</span> sur {rows.length} clubs
          </p>
        )}
      </div>

      {/* En-tête tableau */}
      <div className="grid grid-cols-12 gap-1 px-3 mb-2 text-xs font-display font-bold uppercase tracking-widest text-gray-600">
        <span className="col-span-1">#</span>
        <span className="col-span-5">Club</span>
        <span className="col-span-1 text-center">J</span>
        <span className="col-span-1 text-center">V</span>
        <span className="col-span-1 text-center">N</span>
        <span className="col-span-1 text-center">D</span>
        <span className="col-span-2 text-center">Pts</span>
      </div>

      {/* Lignes */}
      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const isMe = row.club_id === myClubId
          const rank = i + 1
          const zoneColor =
            rank <= 3  ? 'border-l-2 border-l-trophy' :
            rank <= 6  ? 'border-l-2 border-l-grass' :
            rank >= rows.length - 2 ? 'border-l-2 border-l-red-700' : ''

          return (
            <div key={row.club_id}
              className={cn(
                'grid grid-cols-12 gap-1 items-center px-3 py-2.5 rounded-xl transition-all',
                isMe
                  ? 'bg-grass/10 border border-grass/30'
                  : 'bg-card border border-card-border',
                zoneColor
              )}>
              <span className={cn(
                'col-span-1 font-display font-bold text-sm',
                rank === 1 ? 'text-trophy' : rank <= 3 ? 'text-grass' : 'text-gray-500'
              )}>
                {rank === 1 ? '🏆' : rank}
              </span>
              <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                <span className={cn(
                  'font-display font-bold text-sm truncate',
                  isMe ? 'text-grass' : 'text-white'
                )}>
                  {row.name}
                </span>
                {isMe && <span className="text-xs text-grass font-body">★</span>}
              </div>
              <span className="col-span-1 text-center text-gray-400 text-sm font-body">{row.played}</span>
              <span className="col-span-1 text-center text-grass text-sm font-body">{row.won}</span>
              <span className="col-span-1 text-center text-trophy text-sm font-body">{row.drawn}</span>
              <span className="col-span-1 text-center text-red-400 text-sm font-body">{row.lost}</span>
              <span className={cn(
                'col-span-2 text-center font-display font-bold text-base',
                isMe ? 'text-grass' : 'text-white'
              )}>
                {row.points}
              </span>
            </div>
          )
        })}
      </div>

      {/* Légende */}
      <div className="mt-6 space-y-1.5">
        {[
          { color: 'bg-trophy', label: 'Podium (Top 3)' },
          { color: 'bg-grass',  label: 'Europe (Top 6)' },
          { color: 'bg-red-700', label: 'Relégation (Bottom 3)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-sm', color)} />
            <span className="text-gray-500 text-xs font-body">{label}</span>
          </div>
        ))}
      </div>

      {rows.every(r => r.played === 0) && (
        <div className="text-center py-12">
          <Trophy size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-body">Aucun match joué pour l'instant</p>
          <p className="text-gray-600 text-sm font-body mt-1">Le classement s'affichera après la 1ère journée</p>
        </div>
      )}
    </div>
  )
}
