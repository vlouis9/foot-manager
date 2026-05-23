'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, formatMoney } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { X, Check, ChevronRight, Star } from 'lucide-react'

const CATEGORY_INFO: Record<string, { label: string; color: string; bg: string; stars: number }> = {
  bronze:  { label: 'Bronze',  color: 'text-amber-600',   bg: 'bg-amber-900/30 border-amber-700/50',  stars: 1 },
  argent:  { label: 'Argent',  color: 'text-gray-300',    bg: 'bg-gray-800/50 border-gray-600/50',    stars: 2 },
  or:      { label: 'Or',      color: 'text-yellow-400',  bg: 'bg-yellow-900/30 border-yellow-600/50', stars: 3 },
  platine: { label: 'Platine', color: 'text-cyan-300',    bg: 'bg-cyan-900/30 border-cyan-600/50',    stars: 4 },
  diamant: { label: 'Diamant', color: 'text-blue-300',    bg: 'bg-blue-900/40 border-blue-500/60',    stars: 5 },
}

const POS_COLORS: Record<string, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40',
  DEF: 'text-blue-300 bg-blue-900/40',
  MID: 'text-green-300 bg-green-900/40',
  ATT: 'text-red-300 bg-red-900/40',
}

function CategoryBadge({ category }: { category: string }) {
  const info = CATEGORY_INFO[category] ?? CATEGORY_INFO.bronze
  return (
    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-display font-bold', info.bg, info.color)}>
      {Array.from({ length: info.stars }).map((_, i) => (
        <Star key={i} size={8} className="fill-current" />
      ))}
      <span>{info.label}</span>
    </div>
  )
}

function BudgetBar({ budget, wage, newWage }: { budget: number; wage: number; newWage?: number }) {
  const weeksNow  = wage > 0 ? Math.floor(budget / wage) : 99
  const weeksNew  = newWage && newWage > 0 ? Math.floor(budget / newWage) : null
  const delta     = newWage ? newWage - wage : 0

  return (
    <div className="player-card bg-pitch border-card-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-xs font-body">Budget</span>
        <span className="text-grass font-display font-bold text-sm">{formatMoney(budget)}</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-xs font-body">Masse salariale/sem</span>
        <div className="flex items-center gap-1.5">
          <span className="text-trophy font-display font-bold text-sm">{formatMoney(wage)}</span>
          {delta !== 0 && (
            <span className={cn('text-xs font-display font-bold',
              delta > 0 ? 'text-red-400' : 'text-grass')}>
              {delta > 0 ? '+' : ''}{formatMoney(delta)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs font-body">
        <span className="text-gray-600">Couverture</span>
        <div className="flex items-center gap-1.5">
          <span className={cn(weeksNow < 5 ? 'text-red-400' : 'text-gray-400')}>
            {weeksNow > 99 ? '∞' : `${weeksNow} sem.`}
          </span>
          {weeksNew !== null && weeksNew !== weeksNow && (
            <span className={cn('font-bold', weeksNew < weeksNow ? 'text-red-400' : 'text-grass')}>
              → {weeksNew > 99 ? '∞' : `${weeksNew} sem.`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface Player {
  id: string
  lastname: string
  position: string
  market_value: number
  salary: number
  real_team: string
  category: string
}

interface Props {
  userId: string
  club: { id: string; name: string; budget: number; wage_budget: number; current_wage: number }
  draftCards: Player[]
  myPlayers: Player[]
}

export default function OnboardingDraft({ userId, club, draftCards, myPlayers }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [index, setIndex]           = useState(0)
  const [squad, setSquad]           = useState<Player[]>(myPlayers)
  const [wage, setWage]             = useState(club.current_wage)
  const [kept, setKept]             = useState(0)
  const [showExchange, setShowExchange] = useState(false)
  const [exchangeFilter, setExchangeFilter] = useState<string>('ALL')
  const [loading, setLoading]       = useState(false)
  const [toast, setToast]           = useState('')
  const [keptCard, setKeptCard]     = useState<Player | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  const current = draftCards[index]
  const done    = index >= draftCards.length

  // Progression par catégorie
  const categories = ['bronze','argent','or','platine','diamant']
  const currentCat = current ? categories.indexOf(current.category) : -1

  async function handleRefuse() {
    if (index + 1 >= draftCards.length) { await finalize(); return }
    setIndex(i => i + 1)
    setKeptCard(null)
  }

  async function handleKeep(givenPlayer: Player) {
    setLoading(true)
    try {
      // Échanger en base
      const { data: botClub } = await supabase
        .from('clubs')
        .select('id')
        .eq('name', current.real_team)
        .eq('is_bot', true)
        .single()

      // Retirer joueur gardé du pool disponible
      await supabase.from('club_players').delete().eq('player_id', current.id)
      // Retirer joueur cédé du club joueur
      await supabase.from('club_players').delete()
        .eq('club_id', club.id).eq('player_id', givenPlayer.id)

      // Ajouter joueur gardé au club joueur
      await supabase.from('club_players').insert({
        club_id: club.id, player_id: current.id, xp: 0, level: 1,
      })
      // Remettre joueur cédé dans le club bot
      if (botClub) {
        await supabase.from('club_players').insert({
          club_id: botClub.id, player_id: givenPlayer.id, xp: 0, level: 1,
        })
      }

      // Mise à jour locale
      const newSquad = squad.filter(p => p.id !== givenPlayer.id).concat(current)
      const newWage  = wage - givenPlayer.salary + current.salary
      setSquad(newSquad)
      setWage(newWage)
      setKept(k => k + 1)
      setKeptCard(null)
      setShowExchange(false)
      showToast(`✅ ${current.lastname} rejoint ton club`)

      if (index + 1 >= draftCards.length) { await finalize(); return }
      setIndex(i => i + 1)
    } catch (e: any) {
      showToast(`Erreur : ${e.message}`)
    }
    setLoading(false)
  }

  async function finalize() {
    await supabase.from('onboarding_state')
      .update({ draft_done: true, club_chosen: true })
      .eq('user_id', userId)
    router.push('/game/club')
  }

  // ── Écran de fin ──────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-pitch flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="section-title mb-2">Draft terminé !</h2>
        <p className="text-gray-400 font-body mb-6">
          {kept} joueur{kept > 1 ? 's' : ''} récupéré{kept > 1 ? 's' : ''}
        </p>
        <BudgetBar budget={club.budget} wage={wage} />
        <button onClick={finalize} className="btn-primary mt-6 w-full max-w-xs">
          Voir mon effectif →
        </button>
      </div>
    )
  }

  // ── Écran échange ─────────────────────────────────────────
  if (showExchange && keptCard) {
    const positions = ['ALL', 'GK', 'DEF', 'MID', 'ATT']
    const filtered  = squad
      .filter(p => exchangeFilter === 'ALL' || p.position === exchangeFilter)
      .sort((a, b) => b.market_value - a.market_value)

    return (
      <div className="min-h-screen bg-pitch flex flex-col">
        {toast && <div className="toast">{toast}</div>}

        {/* Header */}
        <div className="px-4 pt-6 pb-4 border-b border-card-border">
          <button onClick={() => { setShowExchange(false); setKeptCard(null) }}
            className="text-gray-400 font-body text-sm mb-3">← Annuler</button>

          {/* Carte gardée en visuel */}
          <div className={cn('player-card mb-3', CATEGORY_INFO[keptCard.category]?.bg)}>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-xs', POS_COLORS[keptCard.position])}>
                {keptCard.position}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-white text-lg">{keptCard.lastname}</span>
                  <CategoryBadge category={keptCard.category} />
                </div>
                <p className="text-gray-400 text-xs font-body">{keptCard.real_team} · {formatMoney(keptCard.market_value)}</p>
              </div>
              <Check size={20} className="text-grass flex-shrink-0" />
            </div>
          </div>

          <p className="text-white font-display font-bold text-base">Qui cèdes-tu en échange ?</p>
          <p className="text-gray-500 text-xs font-body mt-0.5">
            Salaire : {formatMoney(keptCard.salary)}/sem
            {' '}(impact : {keptCard.salary > 0 ? '+' : ''}{formatMoney(keptCard.salary - 0)}/sem)
          </p>
        </div>

        {/* Filtres */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-card-border overflow-x-auto">
          {positions.map(pos => (
            <button key={pos} onClick={() => setExchangeFilter(pos)}
              className={cn('flex-shrink-0 px-3 py-1 rounded-lg text-xs font-display font-bold uppercase',
                exchangeFilter === pos ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
              {pos === 'ALL' ? 'Tous' : pos}
            </button>
          ))}
        </div>

        {/* Liste joueurs à céder */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.map(p => {
            const salaryDelta = keptCard.salary - p.salary
            const newWage = wage + salaryDelta
            const weeksOld = p.salary > 0 ? Math.floor(club.budget / wage) : 99
            const weeksNew = newWage > 0 ? Math.floor(club.budget / newWage) : 99

            return (
              <button key={p.id} onClick={() => handleKeep(p)} disabled={loading}
                className="player-card w-full text-left">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-xs', POS_COLORS[p.position])}>
                    {p.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-white truncate">{p.lastname}</span>
                      <CategoryBadge category={p.category} />
                    </div>
                    <p className="text-gray-500 text-xs font-body">{p.real_team}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-gray-300 text-sm font-body">{formatMoney(p.salary)}/sem</p>
                    <p className={cn('text-xs font-display font-bold',
                      salaryDelta > 0 ? 'text-red-400' : salaryDelta < 0 ? 'text-grass' : 'text-gray-500')}>
                      {salaryDelta > 0 ? '+' : ''}{formatMoney(salaryDelta)}/sem
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Écran carte principale ────────────────────────────────
  const catInfo = CATEGORY_INFO[current.category] ?? CATEGORY_INFO.bronze
  const progressByCategory = categories.map((cat, i) => ({
    cat,
    done: i < currentCat,
    active: i === currentCat,
  }))

  return (
    <div className="min-h-screen bg-pitch flex flex-col px-4">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-500 text-xs font-body uppercase tracking-widest">Draft · {club.name}</p>
            <p className="font-display font-bold text-white text-lg">
              Carte {index + 1} / {draftCards.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-grass font-body text-sm">{formatMoney(club.budget)}</p>
            <p className="text-trophy text-xs font-body">{formatMoney(wage)}/sem</p>
          </div>
        </div>

        {/* Barre progression par catégorie */}
        <div className="flex gap-1.5">
          {progressByCategory.map(({ cat, done, active }) => (
            <div key={cat} className="flex-1">
              <div className={cn('h-1.5 rounded-full transition-all',
                done   ? 'bg-grass' :
                active ? `bg-${CATEGORY_INFO[cat]?.color.replace('text-', '')} opacity-80` :
                         'bg-card-border'
              )} style={active ? { backgroundColor: '#f59e0b' } : {}} />
              <p className={cn('text-xs font-body text-center mt-0.5',
                active ? catInfo.color : done ? 'text-grass' : 'text-gray-700')}>
                {CATEGORY_INFO[cat]?.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Carte */}
      <div className={cn('player-card animate-card-reveal flex-1 flex flex-col justify-center py-8 mb-4 border-2', catInfo.bg)}>
        <div className="text-center">
          <CategoryBadge category={current.category} />
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center mx-auto my-4 font-display font-bold text-2xl', POS_COLORS[current.position])}>
            {current.position}
          </div>
          <h2 className={cn('font-display font-bold text-4xl mb-1', catInfo.color)}>
            {current.lastname}
          </h2>
          <p className="text-gray-400 font-body text-sm">{current.real_team}</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="stat-pill">
              <span>💰</span>
              <span>{formatMoney(current.market_value)}</span>
            </div>
            <div className="stat-pill">
              <span>💼</span>
              <span>{formatMoney(current.salary)}/sem</span>
            </div>
          </div>
        </div>
      </div>

      {/* Impact budget si on garde */}
      <div className="mb-4">
        <BudgetBar
          budget={club.budget}
          wage={wage}
          newWage={wage + current.salary}
        />
      </div>

      {/* Boutons */}
      <div className="flex gap-3 pb-8">
        <button onClick={handleRefuse} disabled={loading}
          className="btn-secondary flex-1 flex items-center justify-center gap-2">
          <X size={18} />
          Refuser
        </button>
        <button
          onClick={() => { setKeptCard(current); setShowExchange(true) }}
          disabled={loading}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          <Check size={18} />
          Garder
        </button>
      </div>

      {/* Passer le draft */}
      <button onClick={finalize} className="text-gray-600 text-xs font-body text-center pb-4">
        Passer le reste →
      </button>
    </div>
  )
}
