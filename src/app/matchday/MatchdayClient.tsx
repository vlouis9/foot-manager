'use client'
import { useState, useCallback } from 'react'
import type { Club, ClubPlayer, Player, Formation, Position } from '@/types'
import { cn, formatMoney } from '@/lib/utils'
import { Lock, Unlock, ChevronUp, ChevronDown, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type CPWithPlayer = ClubPlayer & { player: Player }

const FORMATIONS: Formation[] = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '5-3-2']

const FORMATION_SLOTS: Record<Formation, { pos: Position; label: string }[]> = {
  '4-3-3':   [
    { pos: 'GK', label: 'G' },
    { pos: 'DEF', label: 'DD' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DG' },
    { pos: 'MID', label: 'MD' }, { pos: 'MID', label: 'MC' }, { pos: 'MID', label: 'MG' },
    { pos: 'ATT', label: 'AD' }, { pos: 'ATT', label: 'AC' }, { pos: 'ATT', label: 'AG' },
  ],
  '4-4-2':   [
    { pos: 'GK', label: 'G' },
    { pos: 'DEF', label: 'DD' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DG' },
    { pos: 'MID', label: 'MD' }, { pos: 'MID', label: 'MC' }, { pos: 'MID', label: 'MC' }, { pos: 'MID', label: 'MG' },
    { pos: 'ATT', label: 'AD' }, { pos: 'ATT', label: 'AG' },
  ],
  '3-5-2':   [
    { pos: 'GK', label: 'G' },
    { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DC' },
    { pos: 'MID', label: 'MD' }, { pos: 'MID', label: 'MC' }, { pos: 'MID', label: 'MC' }, { pos: 'MID', label: 'MC' }, { pos: 'MID', label: 'MG' },
    { pos: 'ATT', label: 'AD' }, { pos: 'ATT', label: 'AG' },
  ],
  '4-2-3-1': [
    { pos: 'GK', label: 'G' },
    { pos: 'DEF', label: 'DD' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DG' },
    { pos: 'MID', label: 'MD' }, { pos: 'MID', label: 'MG' },
    { pos: 'MID', label: 'MO' }, { pos: 'MID', label: 'MO' }, { pos: 'MID', label: 'MO' },
    { pos: 'ATT', label: 'BU' },
  ],
  '5-3-2':   [
    { pos: 'GK', label: 'G' },
    { pos: 'DEF', label: 'DD' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DC' }, { pos: 'DEF', label: 'DG' },
    { pos: 'MID', label: 'MD' }, { pos: 'MID', label: 'MC' }, { pos: 'MID', label: 'MG' },
    { pos: 'ATT', label: 'AD' }, { pos: 'ATT', label: 'AG' },
  ],
}

const POS_COLORS: Record<Position, string> = {
  GK:  'text-yellow-300 bg-yellow-900/40 border-yellow-800/40',
  DEF: 'text-blue-300 bg-blue-900/40 border-blue-800/40',
  MID: 'text-green-300 bg-green-900/40 border-green-800/40',
  ATT: 'text-red-300 bg-red-900/40 border-red-800/40',
}

interface Props {
  club: Club
  gameweek: number
  players: CPWithPlayer[]
  existingLineup: any
  currentMatch: any
}

export default function MatchdayClient({ club, gameweek, players, existingLineup, currentMatch }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [formation, setFormation] = useState<Formation>(existingLineup?.formation ?? '4-3-3')
  const [starters, setStarters] = useState<(CPWithPlayer | null)[]>(() => {
    if (!existingLineup) return new Array(11).fill(null)
    const lp = existingLineup.lineup_players ?? []
    const starterIds = lp.filter((p: any) => p.starter).map((p: any) => p.player_id)
    return starterIds.map((id: string) => players.find(p => p.player_id === id) ?? null)
  })
  const [bench, setBench] = useState<CPWithPlayer[]>(() => {
    if (!existingLineup) return []
    const lp = existingLineup.lineup_players ?? []
    const benchEntries = lp.filter((p: any) => !p.starter).sort((a: any, b: any) => a.bench_order - b.bench_order)
    return benchEntries.map((e: any) => players.find(p => p.player_id === e.player_id)).filter(Boolean) as CPWithPlayer[]
  })
  const [locked, setLocked] = useState(existingLineup?.locked ?? false)
  const [selecting, setSelecting] = useState<number | null>(null) // index slot titulaire
  const [addingBench, setAddingBench] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const slots = FORMATION_SLOTS[formation]
  const usedIds = new Set([
    ...starters.filter(Boolean).map(p => p!.player_id),
    ...bench.map(p => p.player_id),
  ])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function selectStarter(slotIndex: number, cp: CPWithPlayer) {
    setStarters(prev => {
      const next = [...prev]
      next[slotIndex] = cp
      return next
    })
    setSelecting(null)
  }

  function removeStarter(index: number) {
    setStarters(prev => { const n = [...prev]; n[index] = null; return n })
  }

  function addToBench(cp: CPWithPlayer) {
    if (bench.length >= 7) { showToast('Banc complet (7 max)'); return }
    setBench(prev => [...prev, cp])
    setAddingBench(false)
  }

  function removeFromBench(idx: number) {
    setBench(prev => prev.filter((_, i) => i !== idx))
  }

  function moveBench(idx: number, dir: 'up' | 'down') {
    setBench(prev => {
      const n = [...prev]
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= n.length) return n
      ;[n[idx], n[target]] = [n[target], n[idx]]
      return n
    })
  }

  async function saveLineup() {
    const filledStarters = starters.filter(Boolean)
    if (filledStarters.length < 11) { showToast('Sélectionne 11 titulaires'); return }
    setSaving(true)
    try {
      // Upsert lineup
      const { data: lu, error: le } = await supabase
        .from('lineups')
        .upsert({ club_id: club.id, gameweek, formation, locked: false }, { onConflict: 'club_id,gameweek' })
        .select().single()
      if (le) throw le

      // Supprimer anciens lineup_players
      await supabase.from('lineup_players').delete().eq('lineup_id', lu.id)

      // Insérer titulaires
      const starterInserts = starters.map(cp => ({
        lineup_id: lu.id,
        player_id: cp!.player_id,
        starter: true,
        bench_order: null,
      }))

      // Insérer remplaçants
      const benchInserts = bench.map((cp, i) => ({
        lineup_id: lu.id,
        player_id: cp.player_id,
        starter: false,
        bench_order: i + 1,
      }))

      await supabase.from('lineup_players').insert([...starterInserts, ...benchInserts])
      showToast('✅ Composition sauvegardée')
      router.refresh()
    } catch (e) {
      showToast('Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  async function lockLineup() {
    const filledStarters = starters.filter(Boolean)
    if (filledStarters.length < 11) { showToast('Sélectionne 11 titulaires avant de verrouiller'); return }
    await saveLineup()
    await supabase.from('lineups').update({ locked: true })
      .eq('club_id', club.id).eq('gameweek', gameweek)
    setLocked(true)
    showToast('🔒 Composition verrouillée')
    router.refresh()
  }

  // ── Écran de sélection joueur ───────────────────────────────
  if (selecting !== null || addingBench) {
    const slot = selecting !== null ? slots[selecting] : null
    const eligible = players.filter(cp => {
      if (usedIds.has(cp.player_id)) return false
      if (slot) {
        // Tolérance : GK strict, sinon position souple
        if (slot.pos === 'GK') return cp.player.position === 'GK'
        return cp.player.position !== 'GK'
      }
      return true
    }).sort((a, b) => b.player.market_value - a.player.market_value)

    return (
      <div className="page max-w-lg mx-auto">
        <div className="flex items-center gap-3 pt-2 mb-4">
          <button onClick={() => { setSelecting(null); setAddingBench(false) }}
            className="text-gray-400 font-body text-sm">← Retour</button>
          <h2 className="font-display font-bold text-xl text-white">
            {slot ? `Choisir ${slot.label}` : 'Choisir remplaçant'}
          </h2>
        </div>
        <div className="space-y-2">
          {eligible.map(cp => (
            <button key={cp.id}
              onClick={() => selecting !== null ? selectStarter(selecting, cp) : addToBench(cp)}
              className="player-card w-full text-left flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs border',
                POS_COLORS[cp.player.position as Position])}>
                {cp.player.position}
              </div>
              <div className="flex-1">
                <p className="font-display font-bold text-white">{cp.player.lastname}</p>
                <p className="text-gray-500 text-xs font-body">{cp.player.real_team}</p>
              </div>
              <p className="text-grass text-sm font-body">{formatMoney(cp.player.market_value)}</p>
            </button>
          ))}
          {eligible.length === 0 && (
            <p className="text-gray-500 text-center font-body py-8">Aucun joueur disponible pour ce poste</p>
          )}
        </div>
      </div>
    )
  }

  // ── Écran résultat (si match traité) ───────────────────────
  if (currentMatch?.processed) {
    const isHome = currentMatch.home_club_id === club.id
    const myScore = isHome ? currentMatch.home_score : currentMatch.away_score
    const oppScore = isHome ? currentMatch.away_score : currentMatch.home_score
    const oppName = isHome ? currentMatch.away_club?.name : currentMatch.home_club?.name
    const result = myScore > oppScore ? 'V' : myScore === oppScore ? 'N' : 'D'
    const resultColor = result === 'V' ? 'text-grass' : result === 'N' ? 'text-trophy' : 'text-red-400'

    return (
      <div className="page max-w-lg mx-auto">
        <div className="pt-2 mb-6">
          <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-1">Journée {gameweek} · Résultat</p>
          <h1 className="section-title">Match terminé</h1>
        </div>
        <div className="player-card text-center mb-4">
          <div className="flex items-center justify-around py-4">
            <div>
              <p className="font-display font-bold text-xl text-white">{club.name}</p>
              <p className={cn('font-display font-bold text-5xl mt-2', resultColor)}>{myScore?.toFixed(0)}</p>
            </div>
            <div className="text-gray-600 font-display font-bold text-2xl">–</div>
            <div>
              <p className="font-display font-bold text-xl text-white">{oppName}</p>
              <p className="font-display font-bold text-5xl mt-2 text-gray-400">{oppScore?.toFixed(0)}</p>
            </div>
          </div>
          <div className={cn('font-display font-bold text-2xl pb-4', resultColor)}>
            {result === 'V' ? '🏆 Victoire' : result === 'N' ? '🤝 Match nul' : '❌ Défaite'}
          </div>
        </div>
        <p className="text-gray-500 text-xs font-body text-center">
          Score basé sur les performances réelles de tes joueurs
        </p>
      </div>
    )
  }

  // ── Écran composition principal ────────────────────────────
  const starterCount = starters.filter(Boolean).length
  const isComplete = starterCount === 11

  return (
    <div className="page max-w-lg mx-auto">
      {toast && (
        <div className="toast">{toast}</div>
      )}

      <div className="pt-2 mb-4 flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-0.5">Journée {gameweek}</p>
          <h1 className="section-title">Composition</h1>
        </div>
        {locked && (
          <div className="flex items-center gap-1 bg-red-900/30 border border-red-800/40 px-3 py-1.5 rounded-xl">
            <Lock size={14} className="text-red-400" />
            <span className="text-red-400 text-xs font-display font-bold">VERROUILLÉ</span>
          </div>
        )}
      </div>

      {/* Sélecteur formation */}
      {!locked && (
        <div className="mb-4">
          <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-2">Formation</p>
          <div className="flex gap-2 flex-wrap">
            {FORMATIONS.map(f => (
              <button key={f} onClick={() => { setFormation(f); setStarters(new Array(FORMATION_SLOTS[f].length).fill(null)) }}
                className={cn('px-3 py-1.5 rounded-xl text-sm font-display font-bold transition-all',
                  formation === f ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grille titulaires */}
      <p className="text-gray-500 text-xs font-body uppercase tracking-widest mb-2">
        Titulaires ({starterCount}/11)
      </p>
      <div className="grid grid-cols-1 gap-2 mb-4">
        {slots.map((slot, i) => {
          const cp = starters[i]
          return (
            <div key={i} className={cn('player-card flex items-center gap-3 transition-all',
              !locked && 'cursor-pointer active:bg-grass/5',
              !cp && 'border-dashed opacity-60'
            )} onClick={() => !locked && setSelecting(i)}>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs border',
                POS_COLORS[slot.pos])}>
                {slot.label}
              </div>
              {cp ? (
                <>
                  <div className="flex-1">
                    <p className="font-display font-bold text-white">{cp.player.lastname}</p>
                    <p className="text-gray-500 text-xs font-body">{cp.player.real_team}</p>
                  </div>
                  {!locked && (
                    <button onClick={e => { e.stopPropagation(); removeStarter(i) }}
                      className="text-gray-600 text-xs font-body px-2 py-1 hover:text-red-400">✕</button>
                  )}
                </>
              ) : (
                <p className="text-gray-600 font-body text-sm flex-1">
                  {locked ? '—' : `+ Choisir ${slot.label}`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Banc */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-500 text-xs font-body uppercase tracking-widest">
            Remplaçants ({bench.length}/7)
          </p>
          {!locked && bench.length < 7 && (
            <button onClick={() => setAddingBench(true)}
              className="text-grass text-xs font-display font-bold">+ Ajouter</button>
          )}
        </div>
        {bench.length === 0 && (
          <p className="text-gray-600 font-body text-sm py-2">Aucun remplaçant sélectionné</p>
        )}
        <div className="space-y-2">
          {bench.map((cp, i) => (
            <div key={cp.id} className="player-card flex items-center gap-3">
              <span className="text-gray-600 font-display font-bold text-sm w-5">{i + 1}</span>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-bold text-xs',
                POS_COLORS[cp.player.position as Position])}>
                {cp.player.position}
              </div>
              <div className="flex-1">
                <p className="font-display font-bold text-white text-sm">{cp.player.lastname}</p>
              </div>
              {!locked && (
                <div className="flex items-center gap-1">
                  <button onClick={() => moveBench(i, 'up')} disabled={i === 0}
                    className="text-gray-600 disabled:opacity-30 p-1"><ChevronUp size={14} /></button>
                  <button onClick={() => moveBench(i, 'down')} disabled={i === bench.length - 1}
                    className="text-gray-600 disabled:opacity-30 p-1"><ChevronDown size={14} /></button>
                  <button onClick={() => removeFromBench(i)}
                    className="text-gray-600 hover:text-red-400 p-1 text-xs">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Note remplacement auto */}
      <div className="player-card bg-grass/5 border-grass/20 mb-4">
        <p className="text-grass text-xs font-body">
          ⚡ Si un titulaire joue moins de 45 min, le 1er remplaçant disponible entre automatiquement au coefficient 0.7
        </p>
      </div>

      {/* Boutons action */}
      {!locked && (
        <div className="flex gap-3">
          <button onClick={saveLineup} disabled={saving || !isComplete} className="btn-secondary flex-1">
            {saving ? '...' : '💾 Sauvegarder'}
          </button>
          <button onClick={lockLineup} disabled={saving || !isComplete} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Lock size={16} />
            Verrouiller
          </button>
        </div>
      )}

      {locked && (
        <div className="player-card border-grass/30 bg-grass/5 text-center py-4">
          <CheckCircle size={24} className="text-grass mx-auto mb-2" />
          <p className="font-display font-bold text-grass text-lg">Composition prête</p>
          <p className="text-gray-400 text-sm font-body mt-1">
            En attente des résultats de la journée {gameweek}
          </p>
        </div>
      )}
    </div>
  )
}
