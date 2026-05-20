'use client'
import Link from 'next/link'
import type { Club, Match } from '@/types'
import { formatMoney } from '@/lib/utils'
import { Package, Trophy, ShoppingCart, Users } from 'lucide-react'

interface Props {
  club: Club
  pendingPacks: number
  nextMatch: any
  gameweek: number
}

export default function Dashboard({ club, pendingPacks, nextMatch, gameweek }: Props) {
  const wageCoverage = club.wage_budget > 0
    ? Math.min(100, Math.round((club.budget / club.wage_budget) * 10))
    : 100

  return (
    <div className="page max-w-lg mx-auto">
      {/* Header club */}
      <div className="mb-6 pt-2">
        <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-1">
          Journée {gameweek}
        </p>
        <h1 className="font-display font-bold text-4xl uppercase text-white">
          {club.name}
        </h1>
      </div>

      {/* Budget */}
      <div className="player-card mb-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm font-body">Budget disponible</span>
          <span className="font-display font-bold text-xl text-grass">
            {formatMoney(club.budget)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 font-body">
          <span>Masse salariale</span>
          <span>{formatMoney(club.wage_budget)} / sem.</span>
        </div>
        <div className="w-full bg-card-border rounded-full h-1 mt-2">
          <div
            className="bg-trophy h-1 rounded-full"
            style={{ width: `${wageCoverage}%` }}
          />
        </div>
      </div>

      {/* Paquets en attente */}
      {pendingPacks > 0 && (
        <Link href="/packs">
          <div className="player-card border-trophy/40 bg-trophy/5 mb-3 flex items-center gap-3 animate-pulse-green">
            <div className="w-10 h-10 rounded-xl bg-trophy/20 flex items-center justify-center">
              <Package size={20} className="text-trophy" />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold text-white">
                {pendingPacks} paquet{pendingPacks > 1 ? 's' : ''} à ouvrir
              </p>
              <p className="text-gray-400 text-xs font-body">Appuie pour ouvrir</p>
            </div>
            <span className="text-trophy font-display font-bold text-lg">→</span>
          </div>
        </Link>
      )}

      {/* Prochain match */}
      <div className="player-card mb-3">
        <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3">
          Prochain match · J{gameweek}
        </p>
        {nextMatch ? (
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-lg text-white">
              {nextMatch.home_club?.name ?? '?'}
            </span>
            <span className="text-gray-600 font-body text-sm px-3">vs</span>
            <span className="font-display font-bold text-lg text-white">
              {nextMatch.away_club?.name ?? '?'}
            </span>
          </div>
        ) : (
          <p className="text-gray-500 font-body text-sm">Aucun match planifié</p>
        )}
      </div>

      {/* Actions rapides */}
      <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3 mt-5">
        Actions
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/squad',    icon: Users,        label: 'Mon Effectif',  sub: 'Gérer les joueurs' },
          { href: '/matchday', icon: Trophy,       label: 'Composition',   sub: 'Préparer le XI'    },
          { href: '/market',   icon: ShoppingCart, label: 'Mercato',       sub: 'Acheter / Vendre'  },
          { href: '/packs',    icon: Package,      label: 'Paquets',       sub: `${pendingPacks} en attente` },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link key={href} href={href}>
            <div className="player-card h-full">
              <Icon size={20} className="text-grass mb-2" />
              <p className="font-display font-bold text-white text-base">{label}</p>
              <p className="text-gray-500 text-xs font-body mt-0.5">{sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Réputation */}
      <div className="player-card mt-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm font-body">Réputation</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < Math.round(club.reputation / 20) ? 'bg-trophy' : 'bg-card-border'
                }`}
              />
            ))}
          </div>
          <span className="font-display font-bold text-white text-sm">{club.reputation}</span>
        </div>
      </div>
    </div>
  )
}
