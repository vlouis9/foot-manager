'use client'
import { useState } from 'react'
import type { Club, ClubUpgrade, DailyEvent, UpgradeType } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Zap, Shield, Brain, GraduationCap } from 'lucide-react'

const UPGRADE_INFO: Record<UpgradeType, {
  label: string; desc: string; icon: any
  effect: (level: number) => string; maxLevel: number
}> = {
  offense_center: {
    label: 'Centre Offensif',
    desc: 'Bonus de score pour tes attaquants et milieux offensifs',
    icon: Zap,
    effect: l => `+${(l * 0.15).toFixed(2)} pts/joueur ATT & MID`,
    maxLevel: 5,
  },
  defense_center: {
    label: 'Centre Défensif',
    desc: 'Bonus de score pour tes gardiens et défenseurs',
    icon: Shield,
    effect: l => `+${(l * 0.15).toFixed(2)} pts/joueur GK & DEF`,
    maxLevel: 5,
  },
  tactical_room: {
    label: 'Salle Tactique',
    desc: 'Bonus collectif si ta formation est respectée',
    icon: Brain,
    effect: l => `+${(l * 0.20).toFixed(2)} pts bonus collectif`,
    maxLevel: 5,
  },
  academy: {
    label: 'Académie',
    desc: 'Tes joueurs gagnent de l\'XP plus rapidement',
    icon: GraduationCap,
    effect: l => `XP × ${(1 + l * 0.25).toFixed(2)}`,
    maxLevel: 3,
  },
}

function upgradeCost(currentLevel: number): number {
  return 200_000 * Math.pow(2, currentLevel)
}

interface Props {
  club: Club
  upgrades: ClubUpgrade[]
  events: DailyEvent[]
}

export default function ClubClient({ club, upgrades, events }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [budget, setBudget] = useState(club.budget)
  const [levels, setLevels] = useState<Record<UpgradeType, number>>(() => {
    const map: Partial<Record<UpgradeType, number>> = {}
    for (const u of upgrades) map[u.type as UpgradeType] = u.level
    return {
      offense_center: map.offense_center ?? 0,
      defense_center: map.defense_center ?? 0,
      tactical_room:  map.tactical_room  ?? 0,
      academy:        map.academy        ?? 0,
    }
  })
  const [loading, setLoading] = useState<UpgradeType | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function handleUpgrade(type: UpgradeType) {
    const currentLevel = levels[type]
    const info = UPGRADE_INFO[type]
    if (currentLevel >= info.maxLevel) return
    const cost = upgradeCost(currentLevel)
    if (budget < cost) { showToast('Budget insuffisant'); return }

    setLoading(type)
    try {
      const newLevel = currentLevel + 1
      await supabase.from('club_upgrades')
        .upsert({ club_id: club.id, type, level: newLevel }, { onConflict: 'club_id,type' })
      const newBudget = budget - cost
      await supabase.from('clubs').update({ budget: newBudget }).eq('id', club.id)
      setBudget(newBudget)
      setLevels(l => ({ ...l, [type]: newLevel }))
      showToast(`✅ ${info.label} amélioré niveau ${newLevel}`)
      router.refresh()
    } catch { showToast('Erreur lors de l\'amélioration') }
    setLoading(null)
  }

  const totalUpgradeLevel = Object.values(levels).reduce((a, b) => a + b, 0)

  return (
    <div className="page max-w-lg mx-auto">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="pt-2 mb-6">
        <h1 className="section-title mb-1">Mon Club</h1>
        <div className="flex items-center gap-4">
          <p className="text-grass font-body text-sm">Budget : {formatMoney(budget)}</p>
          <p className="text-gray-500 text-sm font-body">Niveau total : {totalUpgradeLevel}</p>
        </div>
      </div>

      {/* Réputation */}
      <div className="player-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm font-body">Réputation</span>
          <span className="font-display font-bold text-white">{club.reputation} / 100</span>
        </div>
        <div className="w-full bg-card-border rounded-full h-2">
          <div className="bg-trophy h-2 rounded-full transition-all" style={{ width: `${club.reputation}%` }} />
        </div>
        <p className="text-gray-600 text-xs font-body mt-2">
          Augmente en gagnant des matchs et améliorant ton club
        </p>
      </div>

      {/* Événements actifs */}
      {events.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-500 mb-2">
            Événements actifs
          </p>
          {events.map(ev => (
            <div key={ev.id} className="player-card border-grass/30 bg-grass/5 flex items-center gap-3 mb-2">
              <span className="text-xl">
                {ev.type === 'sponsor_bonus' ? '💰' :
                 ev.type === 'tactical_camp' ? '🧠' :
                 ev.type === 'market_discount' ? '🏷️' : '⚡'}
              </span>
              <div>
                <p className="font-display font-bold text-white text-sm">
                  {ev.type === 'sponsor_bonus'   ? 'Bonus Sponsor' :
                   ev.type === 'tactical_camp'   ? 'Camp Tactique' :
                   ev.type === 'market_discount' ? 'Remise Mercato' : 'Boost Entraînement'}
                </p>
                <p className="text-gray-400 text-xs font-body">
                  Expire le {new Date(ev.expires_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upgrades RPG */}
      <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-500 mb-3">
        Infrastructures
      </p>
      <div className="space-y-3">
        {(Object.keys(UPGRADE_INFO) as UpgradeType[]).map(type => {
          const info = UPGRADE_INFO[type]
          const level = levels[type]
          const cost = upgradeCost(level)
          const isMax = level >= info.maxLevel
          const canAfford = budget >= cost
          const Icon = info.icon

          return (
            <div key={type} className="player-card">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-grass/10 border border-grass/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-grass" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-display font-bold text-white">{info.label}</p>
                    <span className="text-trophy font-display font-bold text-sm">
                      Niv.{level}/{info.maxLevel}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs font-body">{info.desc}</p>
                </div>
              </div>

              {/* Barre de niveau */}
              <div className="flex gap-1 mb-3">
                {Array.from({ length: info.maxLevel }).map((_, i) => (
                  <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-all',
                    i < level ? 'bg-grass' : 'bg-card-border')} />
                ))}
              </div>

              {/* Effet actuel + prochain */}
              <div className="flex items-center justify-between text-xs font-body mb-3">
                {level > 0 && (
                  <span className="text-grass">{info.effect(level)}</span>
                )}
                {!isMax && (
                  <span className="text-gray-500 ml-auto">
                    Prochain : {info.effect(level + 1)}
                  </span>
                )}
              </div>

              {isMax ? (
                <div className="w-full py-2 text-center text-grass text-sm font-display font-bold">
                  ✅ Niveau maximum atteint
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(type)}
                  disabled={!canAfford || loading === type}
                  className={cn('w-full py-2.5 rounded-xl font-display font-bold text-sm uppercase tracking-wide transition-all',
                    canAfford
                      ? 'bg-grass text-pitch active:scale-95'
                      : 'bg-card-border text-gray-600 cursor-not-allowed')}>
                  {loading === type ? '...' : `Améliorer · ${formatMoney(cost)}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Info progression RPG */}
      <div className="player-card mt-4 bg-grass/5 border-grass/20">
        <p className="text-grass text-xs font-body">
          🏗️ Les améliorations deviennent de plus en plus chères. Priorise selon ta stratégie : offensif, défensif, ou tactique.
        </p>
      </div>
    </div>
  )
}
