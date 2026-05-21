'use client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  gameweek: number
  matches: any[]
  myClubId: string | null
}

export default function GameweekClient({ gameweek, matches, myClubId }: Props) {
  return (
    <div className="page max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/results" className="text-gray-400 font-body text-sm flex items-center gap-1">
          <ChevronLeft size={16} />Résultats
        </Link>
        <h1 className="section-title flex-1">Journée {gameweek}</h1>
      </div>

      <div className="space-y-2">
        {matches.map(m => {
          const hc = Array.isArray(m.home_club) ? m.home_club[0] : m.home_club
          const ac = Array.isArray(m.away_club) ? m.away_club[0] : m.away_club
          const isMyMatch = hc?.id === myClubId || ac?.id === myClubId
          const hGoals = m.home_score != null ? Math.round(m.home_score / 10) : '–'
          const aGoals = m.away_score != null ? Math.round(m.away_score / 10) : '–'

          let resultColor = ''
          if (m.processed && isMyMatch) {
            const mine  = hc?.id === myClubId ? m.home_score : m.away_score
            const opp   = hc?.id === myClubId ? m.away_score : m.home_score
            if (mine > opp)      resultColor = 'border-l-2 border-l-grass'
            else if (mine < opp) resultColor = 'border-l-2 border-l-red-600'
            else                 resultColor = 'border-l-2 border-l-trophy'
          }

          return (
            <Link key={m.id} href={`/results/${gameweek}/${m.id}`}>
              <div className={cn('player-card flex items-center gap-2 mb-2', resultColor)}>
                <span className={cn(
                  'font-display font-bold text-sm flex-1 truncate',
                  isMyMatch && hc?.id === myClubId ? 'text-grass' : 'text-white'
                )}>
                  {hc?.name}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.processed ? (
                    <>
                      <span className="font-display font-bold text-white text-xl">{hGoals}</span>
                      <span className="text-gray-600">–</span>
                      <span className="font-display font-bold text-white text-xl">{aGoals}</span>
                    </>
                  ) : (
                    <span className="text-gray-600 text-sm font-body px-2">vs</span>
                  )}
                </div>
                <span className={cn(
                  'font-display font-bold text-sm flex-1 truncate text-right',
                  isMyMatch && ac?.id === myClubId ? 'text-grass' : 'text-white'
                )}>
                  {ac?.name}
                </span>
                <ChevronRight size={14} className="text-gray-600" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
