'use client'
import { useState } from 'react'
import type { Club, ClubUpgrade, DailyEvent, UpgradeType } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Zap, Shield, Brain, GraduationCap, Home, Users } from 'lucide-react'

type ExtendedUpgradeType = UpgradeType | 'training_center' | 'stadium' | 'tactical_staff'

const UPGRADE_INFO: Record<ExtendedUpgradeType, {
  label: string; desc: string; icon: any
  effects: string[]; maxLevel: number; phase: number
}> = {
  offense_center: {
    label: 'Centre Offensif',
    desc: 'Bonus de score pour attaquants et milieux',
    icon: Zap, maxLevel: 5, phase: 1,
    effects: ['','+0.15 pts ATT/MID','+0.30 pts ATT/MID','+0.45 pts ATT/MID','+0.60 pts ATT/MID','+0.75 pts ATT/MID'],
  },
  defense_center: {
    label: 'Centre Défensif',
    desc: 'Bonus de score pour gardiens et défenseurs',
    icon: Shield, maxLevel: 5, phase: 1,
    effects: ['','+0.15 pts GK/DEF','+0.30 pts GK/DEF','+0.45 pts GK/DEF','+0.60 pts GK/DEF','+0.75 pts GK/DEF'],
  },
  tactical_room: {
    label: 'Salle Tactique',
    desc: 'Bonus collectif quand la formation est respectée',
    icon: Brain, maxLevel: 5, phase: 2,
    effects: ['','+0.20 collectif','+0.40 collectif','+0.60 collectif','+0.80 collectif','+1.00 collectif'],
  },
  academy: {
    label: 'Académie',
    desc: 'Tes joueurs progressent plus vite en XP',
    icon: GraduationCap, maxLevel: 3, phase: 1,
    effects: ['','XP ×1.25','XP ×1.50','XP ×2.00'],
  },
  training_center: {
    label: 'Centre d\'entraînement',
    desc: 'XP automatique quotidien pour tous tes joueurs',
    icon: Users, maxLevel: 5, phase: 1,
    effects: ['','+2 XP/j','+4 XP/j','+6 XP/j','+8 XP/j','+12 XP/j'],
  },
  stadium: {
    label: 'Stade',
    desc: 'Bonus budget après chaque victoire à domicile',
    icon: Home, maxLevel: 5, phase: 2,
    effects: ['','+10k€/vic','+20k€/vic','+30k€/vic','+50k€/vic','+80k€/vic'],
  },
  tactical_staff: {
    label: 'Staff Tactique',
    desc: 'Bonus collectif permanent (max +1.0 pt à niv.5)',
    icon: Brain, maxLevel: 5, phase: 2,
    effects: ['','+0.20 pts équipe','+0.40 pts équipe','+0.60 pts équipe','+0.80 pts équipe','+1.00 pts équipe'],
  },
}

const PHASE_LABELS: Record<number, string> = {
  1: 'Phase 1 — Joueurs (J1–J3)',
  2: 'Phase 2 — Club (J4–J7)',
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
  const [levels, setLevels] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const u of upgrades) map[u.type] = u.level
    return map
  })
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function handleUpgrade(type: string) {
    const info = UPGRADE_INFO[type as ExtendedUpgradeType]
    const currentLevel = levels[type] ?? 0
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
      showToast(`✅ ${info.label} → Niveau ${newLevel}`)
      router.refresh()
    } catch { showToast('Erreur') }
    setLoading(null)
  }

  const totalLevel = Object.values(levels).reduce((a, b) => a + b, 0)

  const phases = [1, 2]

  return (
    <div className="page max-w-lg mx-auto">
      {toast && <div className="toast">{toast}</div>}

      <div className="pt-2 mb-4">
        <h1 className="section-title mb-1">Mon Club</h1>
        <div className="flex items-center gap-4">
          <p className="text-grass font-body text-sm">{formatMoney(budget)}</p>
          <p className="text-gray-500 text-sm font-body">Niveau global : {totalLevel}</p>
        </div>
      </div>

      {/* Réputation */}
      <div className="player-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm font-body">Réputation</span>
          <span className="font-display font-bold text-white">{club.reputation}/100</span>
        </div>
        <div className="w-full bg-card-border rounded-full h-2">
          <div className="bg-trophy h-2 rounded-full" style={{ width: `${club.reputation}%` }} />
        </div>
      </div>

      {/* Événements actifs */}
      {events.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-500 mb-2">Événements actifs</p>
          {events.map(ev => (
            <div key={ev.id} className="player-card border-grass/30 bg-grass/5 flex items-center gap-3 mb-2">
              <span className="text-xl">
                {ev.type === 'sponsor_bonus' ? '💰' : ev.type === 'tactical_camp' ? '🧠' :
                 ev.type === 'market_discount' ? '🏷️' : '⚡'}
              </span>
              <div>
                <p className="font-display font-bold text-white text-sm">
                  {ev.type === 'sponsor_bonus' ? 'Bonus Sponsor' : ev.type === 'tactical_camp' ? 'Camp Tactique' :
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

      {/* Infrastructures par phase */}
      {phases.map(phase => {
        const phaseUpgrades = Object.entries(UPGRADE_INFO).filter(([, info]) => info.phase === phase)
        return (
          <div key={phase} className="mb-6">
            <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-500 mb-3">
              {PHASE_LABELS[phase]}
            </p>
            <div className="space-y-3">
              {phaseUpgrades.map(([type, info]) => {
                const level = levels[type] ?? 0
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
                            {level}/{info.maxLevel}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs font-body">{info.desc}</p>
                      </div>
                    </div>

                    {/* Barre niveaux */}
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: info.maxLevel }).map((_, i) => (
                        <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-all',
                          i < level ? 'bg-grass' : 'bg-card-border')} />
                      ))}
                    </div>

                    {/* Effet actuel → prochain */}
                    <div className="flex items-center justify-between text-xs font-body mb-3">
                      {level > 0 && (
                        <span className="text-grass">{info.effects[level]}</span>
                      )}
                      {!isMax && (
                        <span className="text-gray-500 ml-auto">
                          → {info.effects[level + 1]}
                        </span>
                      )}
                    </div>

                    {isMax ? (
                      <div className="w-full py-2 text-center text-grass text-sm font-display font-bold">
                        ✅ Maximum atteint
                      </div>
                    ) : (
                      <button onClick={() => handleUpgrade(type)}
                        disabled={!canAfford || loading === type}
                        className={cn('w-full py-2.5 rounded-xl font-display font-bold text-sm uppercase tracking-wide transition-all',
                          canAfford ? 'bg-grass text-pitch active:scale-95' : 'bg-card-border text-gray-600 cursor-not-allowed')}>
                        {loading === type ? '...' : `Améliorer · ${formatMoney(cost)}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
