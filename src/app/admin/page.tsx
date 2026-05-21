'use client'
import { useState } from 'react'
import { runSimulation } from './actions'

export default function AdminPage() {
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
    <div className="page max-w-lg mx-auto">
      <h1 className="section-title pt-2 mb-6">Admin · Simulation</h1>
      <div className="player-card mb-4">
        <p className="text-gray-400 text-sm font-body mb-3">
          Simule une journée complète avec des stats aléatoires réalistes.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-gray-400 font-body text-sm">Journée :</label>
          <input
            type="number" min={1} max={34} value={gameweek}
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
          <div className="space-y-1.5">
            {log.map((line, i) => (
              <p key={i} className="text-gray-300 text-sm font-body">{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
