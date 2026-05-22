'use client'
import { useState } from 'react'
import Link from 'next/link'
import { runSimulation } from './actions'
import { ChevronLeft, ChevronRight, Upload, Sliders, Play, Database } from 'lucide-react'

const SECTIONS = [
  { id: 'simulation', label: 'Simulation',   icon: Play },
  { id: 'config',     label: 'Config jeu',   icon: Sliders },
  { id: 'calendar',   label: 'Calendrier',   icon: Upload },
  { id: 'data',       label: 'Données',      icon: Database },
]

function SimulationPanel() {
  const [gameweek, setGameweek] = useState(1)
  const [log, setLog] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  async function handleRun() {
    setLoading(true)
    setLog([])
    try {
      setLog(l => [...l, `⚙️ Génération stats J${gameweek}...`])
      const result = await runSimulation(gameweek)
      setLog(l => [
        ...l,
        `✅ ${result.count} stats générées`,
        `✅ ${result.processed} matchs traités`,
        `🎉 Journée ${gameweek} terminée !`,
      ])
    } catch (e: any) {
      setLog(l => [...l, `❌ Erreur : ${e?.message ?? 'inconnue'}`])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="player-card">
        <p className="text-gray-400 text-sm font-body mb-4">
          Simule une journée complète avec des stats aléatoires réalistes.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-gray-400 font-body text-sm">Journée :</label>
          <input type="number" min={1} max={34} value={gameweek}
            onChange={e => setGameweek(Number(e.target.value))}
            className="w-20 bg-card border border-card-border rounded-xl px-3 py-2 text-white font-body text-sm focus:outline-none focus:border-grass/60"
          />
        </div>
        <button onClick={handleRun} disabled={loading} className="btn-primary w-full">
          {loading ? 'Simulation en cours...' : `▶ Simuler J${gameweek}`}
        </button>
      </div>
      {log.length > 0 && (
        <div className="player-card">
          <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3">Log</p>
          {log.map((line, i) => <p key={i} className="text-gray-300 text-sm font-body">{line}</p>)}
        </div>
      )}
    </div>
  )
}

function ConfigPanel() {
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    const res = await fetch('/api/admin/config')
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const row of data) map[row.key] = String(row.value)
    setConfigs(map)
    setLoaded(true)
  }

  async function save() {
    setSaving(true)
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configs),
    })
    setToast('✅ Config sauvegardée')
    setTimeout(() => setToast(''), 2000)
    setSaving(false)
  }

  const CATEGORIES: Record<string, string[]> = {
    'Budgets initiaux': ['budget_psg','budget_top','budget_solide','budget_milieu','budget_outsider','budget_defi'],
    'Coefficients de score': ['coeff_goal','coeff_assist','coeff_clean_sheet','coeff_yellow','coeff_red','coeff_starter','coeff_sub_played','coeff_sub_bench'],
    'Aléatoire': ['random_factor_min','random_factor_max'],
    'RPG': ['rpg_level_bonus','rpg_collective_max'],
    'Marché': ['market_sell_ratio','market_duration_h'],
    'Onboarding': ['draft_cards_count'],
  }

  const LABELS: Record<string, string> = {
    budget_psg: 'PSG', budget_top: 'Top', budget_solide: 'Solide',
    budget_milieu: 'Milieu', budget_outsider: 'Outsider', budget_defi: 'Défi',
    coeff_goal: 'But', coeff_assist: 'Passe déc.', coeff_clean_sheet: 'Clean sheet',
    coeff_yellow: 'Carton jaune', coeff_red: 'Carton rouge',
    coeff_starter: 'Titulaire', coeff_sub_played: 'Rempl. entrant', coeff_sub_bench: 'Rempl. banc',
    random_factor_min: 'Min', random_factor_max: 'Max',
    rpg_level_bonus: 'Bonus/niveau', rpg_collective_max: 'Bonus collectif max',
    market_sell_ratio: 'Ratio vente', market_duration_h: 'Durée offre (h)',
    draft_cards_count: 'Cartes au draft',
  }

  if (!loaded) {
    return (
      <div className="player-card text-center py-6">
        <p className="text-gray-500 font-body mb-4">Charger la configuration actuelle</p>
        <button onClick={load} className="btn-primary">Charger</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {toast && <div className="toast">{toast}</div>}
      {Object.entries(CATEGORIES).map(([cat, keys]) => (
        <div key={cat} className="player-card">
          <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-3">{cat}</p>
          <div className="space-y-2">
            {keys.map(key => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="text-gray-300 text-sm font-body flex-1">{LABELS[key] ?? key}</label>
                <input
                  type="number" step="any"
                  value={configs[key] ?? ''}
                  onChange={e => setConfigs(c => ({ ...c, [key]: e.target.value }))}
                  className="w-28 bg-pitch border border-card-border rounded-lg px-2 py-1.5 text-white font-body text-sm text-right focus:outline-none focus:border-grass/60"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={save} disabled={saving} className="btn-primary w-full">
        {saving ? '...' : '💾 Sauvegarder'}
      </button>
    </div>
  )
}

function CalendarPanel() {
  const [csv, setCsv] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function importCalendar() {
    setLoading(true)
    setResult('')
    const res = await fetch('/api/admin/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    })
    const data = await res.json()
    setResult(data.message ?? data.error)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="player-card">
        <p className="text-gray-400 text-sm font-body mb-2">Format CSV attendu :</p>
        <pre className="text-xs text-grass font-body bg-pitch rounded-lg p-3 overflow-x-auto">
{`gameweek,date,home_team,away_team
1,2024-08-17 21:00,PSG,Monaco
1,2024-08-17 17:00,Lyon,Marseille`}
        </pre>
      </div>
      <div className="player-card">
        <p className="text-gray-400 text-sm font-body mb-2">Colle ton CSV ici :</p>
        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          rows={8}
          placeholder="gameweek,date,home_team,away_team&#10;1,2024-08-17 21:00,PSG,Monaco"
          className="w-full bg-pitch border border-card-border rounded-xl px-3 py-2 text-white font-body text-xs focus:outline-none focus:border-grass/60 resize-none"
        />
        <button onClick={importCalendar} disabled={loading || !csv.trim()} className="btn-primary w-full mt-3">
          {loading ? 'Import...' : '📅 Importer le calendrier'}
        </button>
        {result && <p className="text-grass text-sm font-body mt-2">{result}</p>}
      </div>
    </div>
  )
}

function DataPanel() {
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState('')

  async function action(endpoint: string, label: string) {
    setLoading(label)
    setResult('')
    const res = await fetch(endpoint, { method: 'POST' })
    const data = await res.json()
    setResult(data.message ?? data.error ?? 'OK')
    setLoading(null)
  }

  return (
    <div className="space-y-3">
      {result && (
        <div className="player-card border-grass/30 bg-grass/5">
          <p className="text-grass text-sm font-body">{result}</p>
        </div>
      )}
      {[
        { label: 'Ajouter paquets quotidiens', endpoint: '/api/admin/daily-packs' },
        { label: 'Rafraîchir le marché', endpoint: '/api/admin/refresh-market' },
        { label: 'Réinitialiser le calendrier', endpoint: '/api/admin/reset-calendar', danger: true },
      ].map(({ label, endpoint, danger }) => (
        <button
          key={label}
          onClick={() => action(endpoint, label)}
          disabled={!!loading}
          className={cn('w-full py-3 rounded-xl font-display font-bold text-sm uppercase tracking-wide transition-all',
            danger
              ? 'bg-red-900/30 border border-red-800/40 text-red-400 active:scale-95'
              : 'btn-secondary'
          )}
        >
          {loading === label ? '...' : label}
        </button>
      ))}
    </div>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

export default function AdminPage() {
  const [section, setSection] = useState('simulation')

  const ActiveSection =
    section === 'simulation' ? SimulationPanel :
    section === 'config'     ? ConfigPanel :
    section === 'calendar'   ? CalendarPanel :
    DataPanel

  return (
    <div className="page max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/welcome" className="text-gray-400 font-body text-sm flex items-center gap-1">
          <ChevronLeft size={16} />Accueil
        </Link>
        <h1 className="section-title flex-1">Admin</h1>
      </div>

      {/* Nav sections */}
      <div className="grid grid-cols-4 gap-1.5 mb-6">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSection(id)}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all text-xs font-display font-bold uppercase',
              section === id
                ? 'bg-grass text-pitch border-grass'
                : 'bg-card border-card-border text-gray-400'
            )}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <ActiveSection />
    </div>
  )
}
