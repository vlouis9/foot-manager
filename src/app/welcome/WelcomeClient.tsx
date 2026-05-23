'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, formatMoney } from '@/lib/utils'
import { Play, Plus, Settings, X, ChevronRight, Trophy, Calendar } from 'lucide-react'
import { CLUB_CONFIGS } from '@/types'

interface Props {
  user: { id: string; email: string }
  clubs: any[]
  onboardingStates: any[]
}

const CLUB_TIERS: Record<string, { tier: string; color: string }> = {
  'PSG':        { tier: 'Élite',    color: 'border-purple-500/50 bg-purple-900/10' },
  'Monaco':     { tier: 'Top',      color: 'border-red-500/50 bg-red-900/10' },
  'Marseille':  { tier: 'Top',      color: 'border-sky-500/50 bg-sky-900/10' },
  'Lyon':       { tier: 'Top',      color: 'border-blue-500/50 bg-blue-900/10' },
  'Lille':      { tier: 'Solide',   color: 'border-red-700/50 bg-red-900/10' },
  'Nice':       { tier: 'Solide',   color: 'border-red-400/50 bg-red-900/10' },
  'Lens':       { tier: 'Solide',   color: 'border-yellow-600/50 bg-yellow-900/10' },
  'Rennes':     { tier: 'Solide',   color: 'border-red-800/50 bg-red-900/10' },
  'Strasbourg': { tier: 'Milieu',   color: 'border-blue-700/50 bg-blue-900/10' },
  'Nantes':     { tier: 'Milieu',   color: 'border-yellow-500/50 bg-yellow-900/10' },
  'Toulouse':   { tier: 'Milieu',   color: 'border-violet-600/50 bg-violet-900/10' },
  'Brest':      { tier: 'Milieu',   color: 'border-orange-600/50 bg-orange-900/10' },
  'Lorient':    { tier: 'Outsider', color: 'border-orange-800/50 bg-orange-900/10' },
  'Le Havre':   { tier: 'Outsider', color: 'border-sky-700/50 bg-sky-900/10' },
  'Auxerre':    { tier: 'Outsider', color: 'border-white/20 bg-white/5' },
  'Angers':     { tier: 'Outsider', color: 'border-white/20 bg-white/5' },
  'Paris FC':   { tier: 'Défi',     color: 'border-blue-900/50 bg-blue-900/10' },
  'Metz':       { tier: 'Défi',     color: 'border-yellow-700/50 bg-yellow-900/10' },
}

const TIERS = ['Élite', 'Top', 'Solide', 'Milieu', 'Outsider', 'Défi']

function NewGameDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<'config' | 'club'>('config')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedClub, setSelectedClub] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const config = selectedClub ? CLUB_CONFIGS[selectedClub] : null

  async function startGame() {
    if (!selectedClub || !startDate) return
    setLoading(true)
    const res = await fetch('/api/game/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubName: selectedClub, startDate }),
    })
    if (res.ok) {
      router.push('/onboarding')
    } else {
      alert('Erreur lors de la création de la partie')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/60" onClick={onClose} />
      {/* Drawer */}
      <div className="w-80 bg-pitch border-l border-card-border flex flex-col h-full overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border">
          <h2 className="font-display font-bold text-xl text-white uppercase">Nouvelle partie</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {/* Date de démarrage */}
          <div>
            <label className="text-gray-400 text-xs font-body uppercase tracking-widest mb-2 block">
              Date de démarrage
            </label>
            <input
              type="date"
              value={startDate}
              max={today}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-card border border-card-border rounded-xl px-3 py-3 text-white font-body text-sm focus:outline-none focus:border-grass/60"
            />
            <p className="text-gray-600 text-xs font-body mt-1">
              Ne peut pas être supérieure à la date du jour
            </p>
          </div>

          {/* Choix du club */}
          <div>
            <label className="text-gray-400 text-xs font-body uppercase tracking-widest mb-2 block">
              Choisis ton club
            </label>
            <div className="space-y-3">
              {TIERS.map(tier => {
                const clubs = Object.entries(CLUB_CONFIGS).filter(
                  ([name]) => CLUB_TIERS[name]?.tier === tier
                )
                return (
                  <div key={tier}>
                    <p className="text-gray-600 text-xs font-body mb-1.5">{tier}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {clubs.map(([name, cfg]) => (
                        <button
                          key={name}
                          onClick={() => setSelectedClub(name)}
                          className={cn(
                            'player-card text-left py-2 px-3 transition-all',
                            CLUB_TIERS[name]?.color,
                            selectedClub === name && 'ring-2 ring-grass'
                          )}
                        >
                          <p className="font-display font-bold text-white text-sm">{name}</p>
                          <p className="text-grass text-xs font-body">{formatMoney(cfg.initial_budget)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Résumé si club sélectionné */}
          {config && selectedClub && (
            <div className="player-card border-grass/30 bg-grass/5">
              <p className="text-gray-400 text-xs font-body uppercase tracking-widest mb-2">Résumé</p>
              <div className="space-y-1.5 text-sm font-body">
                <div className="flex justify-between">
                  <span className="text-gray-400">Club</span>
                  <span className="text-white font-bold">{selectedClub}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Budget initial</span>
                  <span className="text-grass font-bold">{formatMoney(config.initial_budget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Masse salariale est.</span>
                  <span className="text-trophy font-bold">~{formatMoney(Math.floor(config.initial_budget * 0.25))}/sem</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Début</span>
                  <span className="text-white">{new Date(startDate).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-8 pt-2 border-t border-card-border">
          <button
            onClick={startGame}
            disabled={!selectedClub || !startDate || loading}
            className="btn-primary w-full"
          >
            {loading ? '...' : 'Lancer le draft →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OptionsDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-80 bg-pitch border-l border-card-border flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border">
          <h2 className="font-display font-bold text-xl text-white uppercase">Options</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 px-4 py-4 space-y-3">
          {[
            { href: '/admin', label: 'Simulation & tests', sub: 'Simuler des journées' },
            { href: '/admin?tab=config', label: 'Coefficients de score', sub: 'Ajuster les paramètres' },
            { href: '/admin?tab=calendar', label: 'Calendrier', sub: 'Importer/modifier' },
            { href: '/admin?tab=data', label: 'Données', sub: 'Paquets, marché, reset' },
          ].map(({ href, label, sub }) => (
            <a key={href} href={href}>
              <div className="player-card flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-white">{label}</p>
                  <p className="text-gray-500 text-xs font-body mt-0.5">{sub}</p>
                </div>
                <ChevronRight size={16} className="text-gray-600" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function WelcomeClient({ user, clubs, onboardingStates }: Props) {
  const router = useRouter()
  const [drawer, setDrawer] = useState<'new' | 'options' | null>(null)

  const hasGame = clubs.length > 0
  const activeClub = clubs[0]
  const activeState = onboardingStates[0]

  return (
    <div className="min-h-screen bg-pitch flex flex-col items-center justify-center relative overflow-hidden">
      {/* Drawers */}
      {drawer === 'new'     && <NewGameDrawer     onClose={() => setDrawer(null)} />}
      {drawer === 'options' && <OptionsDrawer     onClose={() => setDrawer(null)} />}

      {/* Fond déco */}
      <div className="absolute inset-0 opacity-5">
        <div className="w-full h-full" style={{
          backgroundImage: `repeating-linear-gradient(0deg, #22c55e 0px, #22c55e 1px, transparent 1px, transparent 60px),
                            repeating-linear-gradient(90deg, #22c55e 0px, #22c55e 1px, transparent 1px, transparent 60px)`
        }} />
      </div>

      {/* Centre */}
      <div className="relative z-10 flex flex-col items-center px-6 w-full max-w-sm">
        {/* Logo */}
        <div className="w-24 h-24 rounded-3xl bg-grass/10 border-2 border-grass/30 flex items-center justify-center mb-6">
          <span className="text-5xl">⚽</span>
        </div>
        <h1 className="font-display font-bold text-5xl uppercase tracking-wider text-white mb-1">
          Foot Manager
        </h1>
        <p className="text-gray-500 text-sm font-body mb-10">Directeur Sportif Ligue 1</p>

        {/* Boutons principaux */}
        <div className="w-full space-y-3">
          {hasGame && activeState?.draft_done && (
            <button
              onClick={() => router.push('/game')}
              className="w-full bg-grass text-pitch font-display font-bold text-lg uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <Play size={20} fill="currentColor" />
              Continuer — {activeClub?.name}
            </button>
          )}

          {hasGame && !activeState?.draft_done && (
            <button
              onClick={() => router.push('/onboarding')}
              className="w-full bg-trophy text-pitch font-display font-bold text-lg uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <Trophy size={20} />
              Reprendre le draft
            </button>
          )}

          <button
            onClick={() => setDrawer('new')}
            className={cn(
              'w-full font-display font-bold text-lg uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all border',
              hasGame
                ? 'bg-card border-card-border text-gray-300'
                : 'bg-grass text-pitch border-grass'
            )}
          >
            <Plus size={20} />
            Nouvelle partie
          </button>

          <button
            onClick={() => setDrawer('options')}
            className="w-full bg-card border border-card-border text-gray-400 font-display font-bold text-sm uppercase tracking-wide py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Settings size={16} />
            Options admin
          </button>
        </div>

        <p className="text-gray-700 text-xs font-body mt-8">{user.email}</p>
      </div>
    </div>
  )
}
