'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Trophy, Users, BarChart3, ShoppingCart, Package } from 'lucide-react'

const NAV = [
  { href: '/game/match',   icon: Trophy,       label: 'Match'     },
  { href: '/game/club',    icon: Users,        label: 'Club'      },
  { href: '/game/results', icon: BarChart3,    label: 'Résultats' },
  { href: '/game/market',  icon: ShoppingCart, label: 'Mercato'   },
]

function useCountdown(targetDate: string | null) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 })
  useEffect(() => {
    if (!targetDate) return
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) return
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])
  return t
}

interface Props {
  club: { id: string; name: string; budget: number }
  simulatedDate: string
  currentGameweek: number
  pendingPacks: number
  nextCalendarMatch: any
  children: React.ReactNode
}

export default function GameLayoutClient({
  club, simulatedDate, currentGameweek, pendingPacks, nextCalendarMatch, children
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [advancingDay, setAdvancingDay] = useState(false)
  const [showPacks, setShowPacks] = useState(false)
  const countdown = useCountdown(nextCalendarMatch?.match_date ?? null)

  async function advanceDay() {
    setAdvancingDay(true)
    await fetch('/api/advance-day', { method: 'POST' })
    router.refresh()
    setAdvancingDay(false)
  }

  const simDate = new Date(simulatedDate)

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-pitch/95 backdrop-blur border-b border-card-border">
        <div className="flex items-center justify-between px-4 py-2 max-w-lg mx-auto">
          {/* Logo → Welcome */}
          <Link href="/welcome" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-grass/10 border border-grass/30 flex items-center justify-center">
              <span className="text-base">⚽</span>
            </div>
            <span className="font-display font-bold text-white text-sm truncate max-w-[80px]">
              {club.name}
            </span>
          </Link>

          {/* Chrono central */}
          <div className="flex flex-col items-center flex-1 px-2">
            <div className="flex items-center gap-1 text-xs font-body text-gray-500 mb-0.5">
              <span>J{currentGameweek}</span>
              <span>·</span>
              <span>{simDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            </div>
            {nextCalendarMatch ? (
              <div className="flex items-center gap-1 font-display font-bold text-sm text-white">
                {countdown.d > 0 && <span>{countdown.d}j</span>}
                <span>{String(countdown.h).padStart(2,'0')}h</span>
                <span>{String(countdown.m).padStart(2,'0')}m</span>
                <span className="text-gray-500">{String(countdown.s).padStart(2,'0')}s</span>
              </div>
            ) : (
              <span className="text-gray-600 text-xs font-body">Pas de match planifié</span>
            )}
          </div>

          {/* Droite : bouton +1j + packs */}
          <div className="flex items-center gap-2">
            <button
              onClick={advanceDay}
              disabled={advancingDay}
              className="text-xs font-display font-bold text-trophy bg-trophy/10 border border-trophy/30 px-2 py-1 rounded-lg"
            >
              {advancingDay ? '…' : '+1j'}
            </button>
            <Link href="/game/club?tab=inventory" className="relative">
              <div className={cn(
                'w-8 h-8 rounded-lg border flex items-center justify-center transition-all',
                pendingPacks > 0
                  ? 'bg-trophy/20 border-trophy/50 animate-pulse-green'
                  : 'bg-card border-card-border'
              )}>
                <Package size={16} className={pendingPacks > 0 ? 'text-trophy' : 'text-gray-500'} />
              </div>
              {pendingPacks > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-trophy text-pitch text-xs font-display font-bold rounded-full flex items-center justify-center">
                  {pendingPacks > 9 ? '9+' : pendingPacks}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Prochaine affiche */}
        {nextCalendarMatch && (
          <div className="flex items-center justify-center gap-2 px-4 pb-2 text-xs font-body text-gray-500">
            <span className="font-display font-bold text-white">{nextCalendarMatch.home_team}</span>
            <span>vs</span>
            <span className="font-display font-bold text-white">{nextCalendarMatch.away_team}</span>
            <span>· J{nextCalendarMatch.gameweek}</span>
          </div>
        )}
      </header>

      {/* ── CONTENU ─────────────────────────────────────────── */}
      <main className={cn('flex-1 pt-24', nextCalendarMatch ? 'pt-28' : 'pt-16')}>
        {children}
      </main>

      {/* ── BOTTOM NAV ──────────────────────────────────────── */}
      <nav className="nav-bar">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={cn('nav-item', active && 'active')}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
