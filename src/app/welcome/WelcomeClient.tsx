'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, formatMoney } from '@/lib/utils'
import { Play, Plus, Settings, X, ChevronRight, Trophy, Trash2 } from 'lucide-react'
import { CLUB_CONFIGS } from '@/types'

interface Save {
  id: string; club_name: string; budget: number
  reputation: number; gameweek: number; last_played: string; is_active: boolean
}
interface Props {
  user: { id: string; email: string }
  saves: Save[]
  activeSave: Save | null
}

const CLUB_TIERS: Record<string, { tier: string; color: string }> = {
  'PSG':        { tier: 'Élite',    color: 'border-purple-500/50 bg-purple-900/10' },
  'Monaco':     { tier: 'Top',      color: 'border-red-500/50 bg-red-900/10' },
  'Marseille':  { tier: 'Top',      color: 'border-sky-500/50 bg-sky-900/10' },
  'Lyon':       { tier: 'Top',      color: 'border-blue-500/50 bg-blue-900/10' },
  'Lille':      { tier: 'Solide',   color: 'border-red-700/50' },
  'Nice':       { tier: 'Solide',   color: 'border-red-400/50' },
  'Lens':       { tier: 'Solide',   color: 'border-yellow-600/50' },
  'Rennes':     { tier: 'Solide',   color: 'border-red-800/50' },
  'Strasbourg': { tier: 'Milieu',   color: 'border-blue-700/50' },
  'Nantes':     { tier: 'Milieu',   color: 'border-yellow-500/50' },
  'Toulouse':   { tier: 'Milieu',   color: 'border-violet-600/50' },
  'Brest':      { tier: 'Milieu',   color: 'border-orange-600/50' },
  'Lorient':    { tier: 'Outsider', color: 'border-orange-800/50' },
  'Le Havre':   { tier: 'Outsider', color: 'border-sky-700/50' },
  'Auxerre':    { tier: 'Outsider', color: 'border-white/20' },
  'Angers':     { tier: 'Outsider', color: 'border-white/20' },
  'Paris FC':   { tier: 'Défi',     color: 'border-blue-900/50' },
  'Metz':       { tier: 'Défi',     color: 'border-yellow-700/50' },
}
const TIERS = ['Élite','Top','Solide','Milieu','Outsider','Défi']

function NewGameDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [startDate, setStartDate]       = useState(new Date().toISOString().split('T')[0])
  const [selectedClub, setSelectedClub] = useState<string | null>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const today = new Date().toISOString().split('T')[0]
  const config = selectedClub ? CLUB_CONFIGS[selectedClub] : null

  async function startGame() {
    if (!selectedClub || !startDate) return
    setLoading(true); setError('')
    const res = await fetch('/api/game/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubName: selectedClub, startDate }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erreur'); setLoading(false); return }
    router.push('/onboarding')
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-[85vw] max-w-sm bg-pitch border-l border-card-border flex flex-col h-full">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border flex-shrink-0">
          <h2 className="font-display font-bold text-xl text-white uppercase">Nouvelle partie</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-body uppercase tracking-widest mb-2 block">Date de démarrage</label>
            <input type="date" value={startDate} max={today}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-card border border-card-border rounded-xl px-3 py-3 text-white font-body text-sm focus:outline-none focus:border-grass/60" />
            <p className="text-gray-600 text-xs font-body mt-1">≤ date du jour réelle</p>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-body uppercase tracking-widest mb-2 block">Choisis ton club</label>
            {TIERS.map(tier => {
              const clubs = Object.entries(CLUB_CONFIGS).filter(([name]) => CLUB_TIERS[name]?.tier === tier)
              return (
                <div key={tier} className="mb-3">
                  <p className="text-gray-600 text-xs font-body mb-1.5">{tier}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {clubs.map(([name, cfg]) => (
                      <button key={name} onClick={() => setSelectedClub(name)}
                        className={cn('player-card text-left py-2 px-3 transition-all border',
                          CLUB_TIERS[name]?.color,
                          selectedClub === name && 'ring-2 ring-grass')}>
                        <p className="font-display font-bold text-white text-sm">{name}</p>
                        <p className="text-grass text-xs font-body">{formatMoney(cfg.initial_budget)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {config && selectedClub && (
            <div className="player-card border-grass/30 bg-grass/5">
              <p className="text-gray-400 text-xs font-body uppercase tracking-widest mb-2">Résumé</p>
              <div className="space-y-1.5 text-sm font-body">
                {[
                  ['Club', selectedClub, 'text-white'],
                  ['Budget initial', formatMoney(config.initial_budget), 'text-grass'],
                  ['Masse sal. est.', `~${formatMoney(Math.floor(config.initial_budget * 0.25))}/sem`, 'text-trophy'],
                  ['Départ', new Date(startDate + 'T12:00:00').toLocaleDateString('fr-FR'), 'text-white'],
                ].map(([label, value, cls]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className={cn('font-bold', cls)}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-sm font-body">{error}</p>}
        </div>
        <div className="px-4 pb-8 pt-2 border-t border-card-border flex-shrink-0">
          <button onClick={startGame} disabled={!selectedClub || !startDate || loading} className="btn-primary w-full">
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
      <div className="w-[85vw] max-w-sm bg-pitch border-l border-card-border flex flex-col h-full">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-card-border">
          <h2 className="font-display font-bold text-xl text-white uppercase">Options</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
          {[
            { href: '/admin',              label: 'Simulation',    sub: 'Simuler des journées' },
            { href: '/admin?tab=config',   label: 'Coefficients',  sub: 'Paramètres du jeu' },
            { href: '/admin?tab=calendar', label: 'Calendrier',    sub: 'Importer/modifier' },
            { href: '/admin?tab=data',     label: 'Données',       sub: 'Stats, paquets, marché' },
          ].map(({ href, label, sub }) => (
            <a key={href} href={href} onClick={onClose}>
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

export default function WelcomeClient({ user, saves, activeSave }: Props) {
  const router = useRouter()
  const [drawer, setDrawer]         = useState<'new' | 'options' | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  async function handleDelete(saveId: string) {
    setDeleting(saveId)
    await fetch('/api/game/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId }),
    })
    router.refresh()
    setDeleting(null)
    setConfirmDel(null)
  }

  async function loadSave(saveId: string) {
    await fetch('/api/game/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId }),
    })
    router.push('/game')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-pitch flex flex-col items-center justify-center relative overflow-hidden">
      {drawer === 'new'     && <NewGameDrawer     onClose={() => setDrawer(null)} />}
      {drawer === 'options' && <OptionsDrawer     onClose={() => setDrawer(null)} />}

      {/* Confirmation suppression */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="bg-pitch border border-red-800/50 rounded-2xl p-6 w-full max-w-xs">
            <p className="font-display font-bold text-white text-lg mb-2">Supprimer cette partie ?</p>
            <p className="text-gray-400 text-sm font-body mb-5">Cette action est irréversible. Les joueurs retourneront dans leurs clubs.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={() => handleDelete(confirmDel)} disabled={!!deleting}
                className="flex-1 bg-red-900/50 border border-red-700/50 text-red-400 font-display font-bold text-sm uppercase py-3 rounded-xl active:scale-95">
                {deleting ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fond terrain */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(0deg,#22c55e 0,#22c55e 1px,transparent 1px,transparent 60px),
                          repeating-linear-gradient(90deg,#22c55e 0,#22c55e 1px,transparent 1px,transparent 60px)`
      }} />

      <div className="relative z-10 flex flex-col items-center px-6 w-full max-w-sm">
        <div className="w-24 h-24 rounded-3xl bg-grass/10 border-2 border-grass/30 flex items-center justify-center mb-5">
          <span className="text-5xl">⚽</span>
        </div>
        <h1 className="font-display font-bold text-5xl uppercase tracking-wider text-white mb-1">Foot Manager</h1>
        <p className="text-gray-500 text-sm font-body mb-8">Directeur Sportif Ligue 1</p>

        <div className="w-full space-y-3">
          {/* Partie active */}
          {activeSave && (
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/game')}
                className="flex-1 bg-grass text-pitch font-display font-bold text-lg uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Play size={20} fill="currentColor" />
                {activeSave.club_name}
              </button>
              <button onClick={() => setConfirmDel(activeSave.id)}
                className="w-12 h-14 bg-card border border-card-border rounded-2xl flex items-center justify-center text-gray-600 active:text-red-400 active:scale-95 transition-all">
                <Trash2 size={18} />
              </button>
            </div>
          )}

          {/* Autres parties */}
          {saves.filter(s => !s.is_active).map(save => (
            <div key={save.id} className="flex items-center gap-2">
              <button onClick={() => loadSave(save.id)}
                className="flex-1 bg-card border border-card-border text-white font-display font-bold text-sm uppercase tracking-wide py-3 rounded-2xl flex items-center justify-between px-4 active:scale-95">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-trophy" />
                  <span>{save.club_name}</span>
                </div>
                <div className="text-right">
                  <p className="text-grass text-xs font-body">{formatMoney(save.budget)}</p>
                  <p className="text-gray-500 text-xs font-body">J{save.gameweek}</p>
                </div>
              </button>
              <button onClick={() => setConfirmDel(save.id)}
                className="w-12 h-12 bg-card border border-card-border rounded-2xl flex items-center justify-center text-gray-600 active:text-red-400 active:scale-95">
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <button onClick={() => setDrawer('new')}
            className={cn('w-full font-display font-bold text-lg uppercase tracking-wide py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 border',
              activeSave ? 'bg-card border-card-border text-gray-300' : 'bg-grass text-pitch border-grass')}>
            <Plus size={20} />Nouvelle partie
          </button>

          <button onClick={() => setDrawer('options')}
            className="w-full bg-card border border-card-border text-gray-400 font-display font-bold text-sm uppercase tracking-wide py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95">
            <Settings size={16} />Options admin
          </button>
        </div>
        <p className="text-gray-700 text-xs font-body mt-8">{user.email}</p>
      </div>
    </div>
  )
}
