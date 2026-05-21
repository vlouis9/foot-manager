'use client'
import { useState } from 'react'
import type { CardPack, ClubPlayer, Player, EventType } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Package, Star, Zap } from 'lucide-react'

type CPWithPlayer = ClubPlayer & { player: Player }

interface XpCard { type: 'xp'; player: Player; amount: number }
interface EventCard { type: 'event'; eventType: EventType; value: number; label: string }
type RewardCard = XpCard | EventCard

const PACK_INFO = {
  standard:  { label: 'Standard',  icon: '📦', color: 'border-gray-600', cards: 3 },
  journee:   { label: 'Journée',   icon: '⚽', color: 'border-grass/50', cards: 5 },
  prestige:  { label: 'Prestige',  icon: '🏆', color: 'border-trophy/50', cards: 10 },
}

const EVENT_LABELS: Record<EventType, string> = {
  sponsor_bonus:    '💰 Bonus Sponsor',
  tactical_camp:    '🧠 Camp Tactique',
  market_discount:  '🏷️ Remise Mercato',
  training_boost:   '⚡ Boost Entraînement',
}

function generateRewards(pack: CardPack, players: CPWithPlayer[]): RewardCard[] {
  const info = PACK_INFO[pack.type]
  const rewards: RewardCard[] = []
  const seed = pack.id.charCodeAt(0) + pack.id.charCodeAt(4)

  for (let i = 0; i < info.cards; i++) {
    // 1 chance sur 4 d'obtenir une carte Event dans journee/prestige
    if ((pack.type === 'journee' || pack.type === 'prestige') && i === info.cards - 1) {
      const events: EventType[] = ['sponsor_bonus', 'tactical_camp', 'market_discount', 'training_boost']
      const ev = events[(seed + i) % events.length]
      const val = ev === 'sponsor_bonus' ? 50000 : ev === 'market_discount' ? 20 : 1
      rewards.push({ type: 'event', eventType: ev, value: val, label: EVENT_LABELS[ev] })
      continue
    }
    // Carte XP : joueur aléatoire, inversement proportionnel à la valeur
    const sorted = [...players].sort((a, b) => a.player.market_value - b.player.market_value)
    const idx = Math.floor(((seed * (i + 1) * 7919) % 1) * sorted.length)
    const cp = sorted[Math.abs(idx) % sorted.length]
    if (cp) {
      const xpAmount = pack.type === 'standard' ? 10 : pack.type === 'journee' ? 15 : 25
      rewards.push({ type: 'xp', player: cp.player, amount: xpAmount })
    }
  }
  return rewards
}

function RewardDisplay({ card, revealed }: { card: RewardCard; revealed: boolean }) {
  if (!revealed) {
    return (
      <div className="player-card flex flex-col items-center justify-center py-8 opacity-40 cursor-default">
        <Package size={32} className="text-gray-600 mb-2" />
        <p className="text-gray-600 font-body text-sm">?</p>
      </div>
    )
  }

  if (card.type === 'xp') {
    return (
      <div className="player-card border-trophy/30 bg-trophy/5 animate-card-reveal text-center py-4">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Star size={16} className="text-trophy fill-trophy" />
          <span className="text-trophy font-display font-bold text-sm uppercase">Carte XP</span>
        </div>
        <p className="font-display font-bold text-white text-2xl mb-1">{card.player.lastname}</p>
        <p className="text-gray-400 text-xs font-body mb-3">{card.player.real_team}</p>
        <div className="inline-flex items-center gap-1.5 bg-trophy/20 px-3 py-1.5 rounded-xl">
          <Zap size={14} className="text-trophy" />
          <span className="text-trophy font-display font-bold">+{card.amount} XP</span>
        </div>
      </div>
    )
  }

  return (
    <div className="player-card border-grass/30 bg-grass/5 animate-card-reveal text-center py-4">
      <p className="text-2xl mb-2">🎉</p>
      <p className="font-display font-bold text-white text-xl mb-1">{card.label}</p>
      {card.eventType === 'sponsor_bonus' && (
        <p className="text-grass font-display font-bold text-lg">+{formatMoney(card.value)}</p>
      )}
      {card.eventType === 'market_discount' && (
        <p className="text-grass font-display font-bold text-lg">-{card.value}% prochain achat</p>
      )}
      {(card.eventType === 'tactical_camp' || card.eventType === 'training_boost') && (
        <p className="text-grass font-body text-sm">Actif pour la prochaine journée</p>
      )}
    </div>
  )
}

interface Props {
  clubId: string
  packs: CardPack[]
  myPlayers: CPWithPlayer[]
}

export default function PacksClient({ clubId, packs, myPlayers }: Props) {
  const [openingPack, setOpeningPack] = useState<CardPack | null>(null)
  const [rewards, setRewards] = useState<RewardCard[]>([])
  const [revealedIdx, setRevealedIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function openPack(pack: CardPack) {
    setOpeningPack(pack)
    const r = generateRewards(pack, myPlayers)
    setRewards(r)
    setRevealedIdx(-1)
  }

  function revealNext() {
    setRevealedIdx(i => i + 1)
  }

  async function applyAndClose() {
    if (!openingPack) return
    setLoading(true)
    try {
      // Marquer le paquet comme ouvert
      await supabase.from('card_packs').update({ opened: true }).eq('id', openingPack.id)

      // Appliquer les récompenses XP
      for (const card of rewards) {
        if (card.type !== 'xp') continue
        const cp = myPlayers.find(p => p.player_id === card.player.id)
        if (!cp) continue
        const newXp = cp.xp + card.amount
        const newLevel = newXp >= 100 * cp.level ? cp.level + 1 : cp.level
        await supabase.from('club_players')
          .update({ xp: newXp, level: newLevel })
          .eq('id', cp.id)
      }

      // Appliquer les événements
      for (const card of rewards) {
        if (card.type !== 'event') continue
        if (card.eventType === 'sponsor_bonus') {
          await supabase.from('clubs')
            .update({ budget: supabase.rpc as any })
            .eq('id', clubId)
          // Simple update
          const { data: c } = await supabase.from('clubs').select('budget').eq('id', clubId).single()
          if (c) await supabase.from('clubs').update({ budget: c.budget + card.value }).eq('id', clubId)
        } else {
          await supabase.from('daily_events').insert({
            club_id: clubId,
            type: card.eventType,
            value: card.value,
            expires_at: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
          })
        }
      }

      showToast('✅ Récompenses appliquées !')
      setOpeningPack(null)
      router.refresh()
    } catch {
      showToast('Erreur lors de l\'application des récompenses')
    }
    setLoading(false)
  }

  const allRevealed = revealedIdx >= rewards.length - 1

  // ── Écran d'ouverture ──────────────────────────────────────
  if (openingPack) {
    const info = PACK_INFO[openingPack.type]
    return (
      <div className="page max-w-lg mx-auto">
        {toast && <div className="toast">{toast}</div>}
        <div className="pt-2 mb-6 flex items-center justify-between">
          <h2 className="section-title">Paquet {info.label}</h2>
          <span className="text-2xl">{info.icon}</span>
        </div>

        <div className="space-y-3 mb-6">
          {rewards.map((card, i) => (
            <RewardDisplay key={i} card={card} revealed={i <= revealedIdx} />
          ))}
        </div>

        {!allRevealed ? (
          <button onClick={revealNext} className="btn-primary w-full text-lg">
            Révéler →
          </button>
        ) : (
          <button onClick={applyAndClose} disabled={loading} className="btn-primary w-full text-lg">
            {loading ? '...' : '✅ Appliquer les récompenses'}
          </button>
        )}
      </div>
    )
  }

  // ── Liste des paquets ─────────────────────────────────────
  return (
    <div className="page max-w-lg mx-auto">
      {toast && <div className="toast">{toast}</div>}
      <div className="pt-2 mb-6">
        <h1 className="section-title mb-1">Mes Paquets</h1>
        <p className="text-gray-400 text-sm font-body">
          {packs.length} paquet{packs.length !== 1 ? 's' : ''} en attente
        </p>
      </div>

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 font-body text-lg">Aucun paquet disponible</p>
          <p className="text-gray-600 text-sm font-body mt-2">
            Un nouveau paquet Standard arrive chaque jour automatiquement
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Grouper par type */}
          {(['prestige', 'journee', 'standard'] as const).map(type => {
            const group = packs.filter(p => p.type === type)
            if (!group.length) return null
            const info = PACK_INFO[type]
            return (
              <div key={type}>
                <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-600 mb-2 mt-4">
                  {info.label} ({group.length})
                </p>
                {group.map(pack => (
                  <div key={pack.id}
                    className={cn('player-card mb-2', info.color, 'flex items-center gap-4')}>
                    <span className="text-3xl">{info.icon}</span>
                    <div className="flex-1">
                      <p className="font-display font-bold text-white text-base">
                        Paquet {info.label}
                      </p>
                      <p className="text-gray-500 text-xs font-body">
                        {info.cards} cartes · XP + Événements possibles
                      </p>
                    </div>
                    <button onClick={() => openPack(pack)} className="btn-primary py-2 px-4 text-sm">
                      Ouvrir
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Info accumulation */}
      <div className="player-card mt-6 bg-grass/5 border-grass/20">
        <p className="text-grass text-xs font-body">
          📦 Un paquet Standard s'accumule automatiquement chaque jour. Ouvre-les quand tu veux, ils t'attendent.
        </p>
      </div>
    </div>
  )
}
