'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatMoney, cn } from '@/lib/utils'
import { Play, Plus, Settings, Clock, Trophy, ChevronRight, Calendar } from 'lucide-react'

interface Props {
  user: { id: string; email: string }
  clubs: any[]
  onboardingStates: any[]
  nextFixture: any
  currentGameweek: number
  lastProcessedGameweek: number
}

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    if (!targetDate) return
    const interval = setInterval(() => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) { clearInterval(interval); return }
      setTimeLeft({
        days:    Math.floor(diff / 86_400_000),
        hours:   Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-card border border-card-border rounded-xl px-3 py-2 min-w-[56px]">
      <span className="font-display font-bold text-2xl text-white leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-gray-600 text-xs font-body mt-0.5">{label}</span>
    </div>
  )
}

export default function WelcomeClient({
  user, clubs, onboardingStates, nextFixture, currentGameweek, lastProcessedGameweek
}: Props) {
  const router = useRouter()
  const countdown = useCountdown(nextFixture?.match_date ?? null)
  const [advancingDay, setAdvancingDay] = useState(false)

  const hasActiveGame = clubs.length > 0
  const activeClub = clubs[0]
  const activeState = onboardingStates[0]

  async function advanceDay() {
    setAdvancingDay(true)
    try {
      const res = await fetch('/api/advance-day', { method: 'POST' })
      if (!res.ok) throw new Error('Erreur')
      router.refresh()
    } catch {
      alert('Erreur lors de l\'avancement du jour')
    }
    setAdvancingDay(false)
  }

  const now = new Date()
  const simulatedDate = activeState?.simulated_date
    ? new Date(activeState.simulated_date)
    : now

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-grass/10 border border-grass/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">⚽</span>
        </div>
        <h1 className="font-display font-bold text-4xl uppercase tracking-wider text-white">
          Foot Manager
        </h1>
        <p className="text-gray-500 text-sm font-body mt-1">Directeur Sportif Ligue 1</p>
      </div>

      <div className="flex-1 px-4 pb-8 space-y-4 max-w-lg mx-auto w-full">

        {/* Horloge du jeu */}
        <div className="player-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-grass" />
              <span className="text-gray-400 text-sm font-body">Date du jeu</span>
            </div>
            {/* Bouton avancer d'un jour (démo) */}
            <button
              onClick={advanceDay}
              disabled={advancingDay}
              className="text-xs font-display font-bold text-trophy bg-trophy/10 border border-trophy/30 px-3 py-1 rounded-lg active:scale-95 transition-all"
            >
              {advancingDay ? '...' : '+ 1 jour ▶'}
            </button>
          </div>
          <p className="font-display font-bold text-2xl text-white">
            {simulatedDate.toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
          <p className="text-gray-500 text-sm font-body mt-0.5">
            {simulatedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Prochain match */}
        {nextFixture ? (
          <div className="player-card">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-grass" />
              <span className="text-gray-400 text-sm font-body">
                Prochain match · J{nextFixture.gameweek}
              </span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold text-white">{nextFixture.home_team}</span>
              <span className="text-gray-600 font-body text-sm">vs</span>
              <span className="font-display font-bold text-white">{nextFixture.away_team}</span>
            </div>
            <p className="text-gray-500 text-xs font-body mb-3 text-center">
              {new Date(nextFixture.match_date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long'
              })} à {new Date(nextFixture.match_date).toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
            {/* Countdown */}
            <div className="flex items-center justify-center gap-2">
              <CountdownBlock value={countdown.days}    label="j" />
              <span className="text-gray-600 font-display font-bold text-xl">:</span>
              <CountdownBlock value={countdown.hours}   label="h" />
              <span className="text-gray-600 font-display font-bold text-xl">:</span>
              <CountdownBlock value={countdown.minutes} label="min" />
              <span className="text-gray-600 font-display font-bold text-xl">:</span>
              <CountdownBlock value={countdown.seconds} label="sec" />
            </div>
          </div>
        ) : (
          <div className="player-card border-dashed opacity-60 text-center py-4">
            <Calendar size={24} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 font-body text-sm">Aucun calendrier importé</p>
            <Link href="/admin" className="text-grass text-xs font-display font-bold">
              → Importer via Admin
            </Link>
          </div>
        )}

        {/* Partie en cours */}
        {hasActiveGame ? (
          <div>
            <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-2">
              Partie en cours
            </p>
            {clubs.map(club => {
              const state = onboardingStates.find(s => s.user_id === user.id)
              const gw = state?.current_gameweek ?? 1
              const isDraftDone = state?.draft_done ?? false
              return (
                <div key={club.id} className="player-card border-grass/30 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-grass/10 border border-grass/20 flex items-center justify-center">
                      <Trophy size={20} className="text-grass" />
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-white text-lg">{club.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-gray-400 text-xs font-body">
                          Journée {gw} · {formatMoney(club.budget)}
                        </span>
                        <span className="text-gray-600 text-xs font-body">
                          Rép. {club.reputation}/100
                        </span>
                      </div>
                    </div>
                    <Link
                      href={isDraftDone ? '/' : '/onboarding'}
                      className="btn-primary py-2 px-4 text-sm flex items-center gap-1"
                    >
                      <Play size={14} />
                      {isDraftDone ? 'Jouer' : 'Draft'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="player-card border-dashed text-center py-6">
            <p className="text-gray-500 font-body mb-3">Aucune partie en cours</p>
            <Link href="/onboarding" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} />
              Nouvelle partie
            </Link>
          </div>
        )}

        {/* Nouvelle partie */}
        {hasActiveGame && (
          <Link href="/onboarding">
            <div className="player-card flex items-center gap-3 opacity-60">
              <Plus size={20} className="text-grass" />
              <span className="font-display font-bold text-white">Nouvelle partie</span>
            </div>
          </Link>
        )}

        {/* Admin */}
        <div className="pt-2 border-t border-card-border">
          <Link href="/admin">
            <div className="flex items-center justify-between py-3 px-1">
              <div className="flex items-center gap-3">
                <Settings size={18} className="text-gray-500" />
                <span className="text-gray-400 font-body text-sm">Paramètres admin</span>
              </div>
              <ChevronRight size={16} className="text-gray-600" />
            </div>
          </Link>
          <p className="text-gray-600 text-xs font-body px-1">
            {user.email}
          </p>
        </div>
      </div>
    </div>
  )
}
