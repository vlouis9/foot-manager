'use client'
import { useState } from 'react'
import type { Club, ClubPlayer, Market, Player, Position } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Clock, ShoppingCart, TrendingDown, Zap } from 'lucide-react'

type CPWithPlayer = ClubPlayer & { player: Player }
type MarketWithPlayer = Market & { player: Player }

const POS_COLORS: Record<string, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40',
  DEF: 'text-blue-300 bg-blue-900/40',
  MID: 'text-green-300 bg-green-900/40',
  ATT: 'text-red-300 bg-red-900/40',
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expiré'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}j`
  if (h > 0)   return `${h}h ${m}m`
  return `${m}m`
}

function MarketCard({
  item,
  canAfford,
  onBuy,
}: {
  item: MarketWithPlayer
  canAfford: boolean
  onBuy: () => void
}) {
  const p = item.player
  const isOpportunity = item.availability === 'opportunity'
  const isExpensive   = item.availability === 'expensive'
  const remaining     = timeLeft(item.expires_at)

  return (
    <div className={cn(
      'player-card',
      isOpportunity && 'border-trophy/50 bg-trophy/5',
      isExpensive && 'border-red-900/40 opacity-75',
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs', POS_COLORS[p.position])}>
          {p.position}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-display font-bold text-white text-base truncate">{p.lastname}</span>
            {isOpportunity && (
              <span className="flex items-center gap-0.5 text-trophy text-xs font-display font-bold bg-trophy/20 px-1.5 py-0.5 rounded-md">
                <Zap size={10} />DEAL
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs font-body">{p.real_team} · {p.age} ans · {p.position}</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-400 font-body">
              <Clock size={11} />
              <span>{remaining}</span>
            </div>
            <span className="text-gray-600 text-xs font-body">Salaire {formatMoney(p.salary)}/sem</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={cn('font-display font-bold text-lg', isOpportunity ? 'text-trophy' : 'text-white')}>
            {formatMoney(item.price)}
          </p>
          <p className="text-gray-600 text-xs font-body line-through">{formatMoney(p.market_value)}</p>
        </div>
      </div>
      <button
        onClick={onBuy}
        disabled={!canAfford || isExpensive}
        className={cn(
          'w-full mt-3 py-2 rounded-xl font-display font-bold text-sm uppercase tracking-wide transition-all',
          canAfford && !isExpensive
            ? 'bg-grass text-pitch active:scale-95'
            : 'bg-card-border text-gray-600 cursor-not-allowed'
        )}
      >
        {isExpensive ? 'Trop cher' : !canAfford ? 'Budget insuffisant' : '+ Acheter'}
      </button>
    </div>
  )
}

function SellCard({ cp, onSell }: { cp: CPWithPlayer; onSell: () => void }) {
  const p = cp.player
  const sellPrice = Math.floor(p.market_value * 0.85) // -15% à la vente

  return (
    <div className="player-card flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs', POS_COLORS[p.position])}>
        {p.position}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-white truncate">{p.lastname}</p>
        <p className="text-gray-500 text-xs font-body">{p.real_team}</p>
      </div>
      <div className="text-right">
        <p className="text-grass font-body text-sm">{formatMoney(sellPrice)}</p>
        <button onClick={onSell}
          className="text-red-400 text-xs font-display font-bold mt-1 hover:text-red-300">
          Vendre
        </button>
      </div>
    </div>
  )
}

interface Props {
  club: Club
  marketItems: MarketWithPlayer[]
  myPlayers: CPWithPlayer[]
}

export default function MarketClient({ club, marketItems, myPlayers }: Props) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [filter, setFilter] = useState<Position | 'ALL'>('ALL')
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [budget, setBudget] = useState(club.budget)
  const router = useRouter()
  const supabase = createClient()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const filtered = marketItems.filter(item =>
    filter === 'ALL' || item.player.position === filter
  ).sort((a, b) => {
    // Opportunités en premier
    if (a.availability === 'opportunity' && b.availability !== 'opportunity') return -1
    if (b.availability === 'opportunity' && a.availability !== 'opportunity') return  1
    return a.price - b.price
  })

  async function handleBuy(item: MarketWithPlayer) {
    if (item.price > budget) return
    setLoading(item.id)
    try {
      // 1. Retirer de la market
      await supabase.from('market').delete().eq('id', item.id)

      // 2. Retirer du club bot si applicable
      await supabase.from('club_players').delete().eq('player_id', item.player_id)

      // 3. Ajouter à mon club
      await supabase.from('club_players').insert({
        club_id: club.id,
        player_id: item.player_id,
        xp: 0,
        level: 1,
      })

      // 4. Déduire budget
      const newBudget = budget - item.price
      await supabase.from('clubs').update({ budget: newBudget }).eq('id', club.id)
      setBudget(newBudget)

      showToast(`✅ ${item.player.lastname} rejoint ton club !`)
      router.refresh()
    } catch {
      showToast('Erreur lors de l\'achat')
    }
    setLoading(null)
  }

  async function handleSell(cp: CPWithPlayer) {
    const sellPrice = Math.floor(cp.player.market_value * 0.85)
    setLoading(cp.id)
    try {
      // 1. Retirer du club
      await supabase.from('club_players').delete().eq('id', cp.id)

      // 2. Remettre sur le marché
      await supabase.from('market').insert({
        player_id: cp.player_id,
        price: cp.player.market_value,
        availability: 'available',
        expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      })

      // 3. Créditer le budget
      const newBudget = budget + sellPrice
      await supabase.from('clubs').update({ budget: newBudget }).eq('id', club.id)
      setBudget(newBudget)

      showToast(`💰 ${cp.player.lastname} vendu pour ${formatMoney(sellPrice)}`)
      router.refresh()
    } catch {
      showToast('Erreur lors de la vente')
    }
    setLoading(null)
  }

  return (
    <div className="page max-w-lg mx-auto">
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="pt-2 mb-4 flex items-center justify-between">
        <div>
          <h1 className="section-title mb-0.5">Mercato</h1>
          <p className="text-grass font-body text-sm font-medium">
            Budget : {formatMoney(budget)}
          </p>
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-xs font-body bg-card border border-card-border px-3 py-1.5 rounded-xl">
          <ShoppingCart size={13} />
          <span>{marketItems.length} joueurs</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border border-card-border rounded-xl p-1 mb-4">
        {(['buy', 'sell'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all',
              tab === t ? 'bg-grass text-pitch' : 'text-gray-400')}>
            {t === 'buy' ? '🛒 Acheter' : '💰 Vendre'}
          </button>
        ))}
      </div>

      {/* Filtres position */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(['ALL', 'GK', 'DEF', 'MID', 'ATT'] as const).map(pos => (
          <button key={pos} onClick={() => setFilter(pos)}
            className={cn('px-3 py-1 rounded-lg text-xs font-display font-bold uppercase transition-all',
              filter === pos ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
            {pos === 'ALL' ? 'Tous' : pos}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === 'buy' ? (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <TrendingDown size={36} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 font-body">Aucun joueur disponible</p>
            </div>
          )}
          {filtered.map(item => (
            <MarketCard
              key={item.id}
              item={item}
              canAfford={item.price <= budget}
              onBuy={() => handleBuy(item)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-500 text-xs font-body mb-3">
            Prix de vente = 85% de la valeur marchande
          </p>
          {myPlayers
            .filter(cp => filter === 'ALL' || cp.player.position === filter)
            .sort((a, b) => b.player.market_value - a.player.market_value)
            .map(cp => (
              <SellCard key={cp.id} cp={cp} onSell={() => handleSell(cp)} />
            ))
          }
        </div>
      )}
    </div>
  )
}
