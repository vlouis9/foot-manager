'use client'
import { useState, useCallback } from 'react'
import type { Club, ClubPlayer, Player, Formation, Position } from '@/types'
import { cn, formatMoney } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle, Lock, ChevronDown, X } from 'lucide-react'

type CPWithPlayer = ClubPlayer & { player: Player }

const FORMATIONS: Formation[] = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '5-3-2']

// Positions sur le terrain pour chaque formation [x%, y%]
// x = gauche→droite (0=gauche, 100=droite), y = haut→bas (0=haut=but adverse, 100=bas=notre but)
const FORMATION_LAYOUT: Record<Formation, { pos: Position; x: number; y: number; label: string }[]> = {
  '4-3-3': [
    { pos: 'GK',  x: 50, y: 88, label: 'G'  },
    { pos: 'DEF', x: 18, y: 72, label: 'DD' },
    { pos: 'DEF', x: 37, y: 72, label: 'DC' },
    { pos: 'DEF', x: 63, y: 72, label: 'DC' },
    { pos: 'DEF', x: 82, y: 72, label: 'DG' },
    { pos: 'MID', x: 25, y: 52, label: 'MD' },
    { pos: 'MID', x: 50, y: 52, label: 'MC' },
    { pos: 'MID', x: 75, y: 52, label: 'MG' },
    { pos: 'ATT', x: 20, y: 25, label: 'AD' },
    { pos: 'ATT', x: 50, y: 20, label: 'AC' },
    { pos: 'ATT', x: 80, y: 25, label: 'AG' },
  ],
  '4-4-2': [
    { pos: 'GK',  x: 50, y: 88, label: 'G'  },
    { pos: 'DEF', x: 18, y: 72, label: 'DD' },
    { pos: 'DEF', x: 37, y: 72, label: 'DC' },
    { pos: 'DEF', x: 63, y: 72, label: 'DC' },
    { pos: 'DEF', x: 82, y: 72, label: 'DG' },
    { pos: 'MID', x: 18, y: 50, label: 'MD' },
    { pos: 'MID', x: 38, y: 50, label: 'MC' },
    { pos: 'MID', x: 62, y: 50, label: 'MC' },
    { pos: 'MID', x: 82, y: 50, label: 'MG' },
    { pos: 'ATT', x: 33, y: 22, label: 'AD' },
    { pos: 'ATT', x: 67, y: 22, label: 'AG' },
  ],
  '3-5-2': [
    { pos: 'GK',  x: 50, y: 88, label: 'G'  },
    { pos: 'DEF', x: 25, y: 72, label: 'DC' },
    { pos: 'DEF', x: 50, y: 72, label: 'DC' },
    { pos: 'DEF', x: 75, y: 72, label: 'DC' },
    { pos: 'MID', x: 10, y: 52, label: 'MD' },
    { pos: 'MID', x: 30, y: 52, label: 'MC' },
    { pos: 'MID', x: 50, y: 52, label: 'MC' },
    { pos: 'MID', x: 70, y: 52, label: 'MC' },
    { pos: 'MID', x: 90, y: 52, label: 'MG' },
    { pos: 'ATT', x: 33, y: 22, label: 'AD' },
    { pos: 'ATT', x: 67, y: 22, label: 'AG' },
  ],
  '4-2-3-1': [
    { pos: 'GK',  x: 50, y: 88, label: 'G'  },
    { pos: 'DEF', x: 18, y: 74, label: 'DD' },
    { pos: 'DEF', x: 37, y: 74, label: 'DC' },
    { pos: 'DEF', x: 63, y: 74, label: 'DC' },
    { pos: 'DEF', x: 82, y: 74, label: 'DG' },
    { pos: 'MID', x: 33, y: 58, label: 'MD' },
    { pos: 'MID', x: 67, y: 58, label: 'MD' },
    { pos: 'MID', x: 18, y: 38, label: 'MO' },
    { pos: 'MID', x: 50, y: 38, label: 'MO' },
    { pos: 'MID', x: 82, y: 38, label: 'MO' },
    { pos: 'ATT', x: 50, y: 18, label: 'BU' },
  ],
  '5-3-2': [
    { pos: 'GK',  x: 50, y: 88, label: 'G'  },
    { pos: 'DEF', x: 10, y: 72, label: 'DD' },
    { pos: 'DEF', x: 30, y: 72, label: 'DC' },
    { pos: 'DEF', x: 50, y: 72, label: 'DC' },
    { pos: 'DEF', x: 70, y: 72, label: 'DC' },
    { pos: 'DEF', x: 90, y: 72, label: 'DG' },
    { pos: 'MID', x: 25, y: 50, label: 'MD' },
    { pos: 'MID', x: 50, y: 50, label: 'MC' },
    { pos: 'MID', x: 75, y: 50, label: 'MG' },
    { pos: 'ATT', x: 33, y: 22, label: 'AD' },
    { pos: 'ATT', x: 67, y: 22, label: 'AG' },
  ],
}

const POS_COLORS: Record<Position, string> = {
  GK:  'bg-yellow-800/80 border-yellow-500/60 text-yellow-200',
  DEF: 'bg-blue-800/80 border-blue-500/60 text-blue-200',
  MID: 'bg-green-800/80 border-green-500/60 text-green-200',
  ATT: 'bg-red-800/80 border-red-500/60 text-red-200',
}

function PitchSlot({
  slot, player, onTap, locked
}: {
  slot: { pos: Position; x: number; y: number; label: string }
  player: CPWithPlayer | null
  onTap: () => void
  locked: boolean
}) {
  return (
    <button
      onClick={locked ? undefined : onTap}
      disabled={locked}
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}
      className="absolute flex flex-col items-center"
    >
      <div className={cn(
        'w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all',
        player
          ? POS_COLORS[player.player.position as Position]
          : 'bg-white/10 border-white/20 border-dashed',
        !locked && !player && 'active:scale-95',
      )}>
        {player ? (
          <span className="font-display font-bold text-xs leading-tight text-center px-0.5 truncate max-w-[44px]">
            {player.player.lastname.slice(0, 6)}
          </span>
        ) : (
          <span className="text-white/30 font-display font-bold text-xs">{slot.label}</span>
        )}
      </div>
      {player && (
        <span className="text-xs font-body text-white/60 mt-0.5 leading-none">{slot.label}</span>
      )}
    </button>
  )
}

// ── Drawer de sélection joueur ────────────────────────────────
function PlayerPickerDrawer({
  slot, players, usedIds, onSelect, onClose
}: {
  slot: { pos: Position; label: string }
  players: CPWithPlayer[]
  usedIds: Set<string>
  onSelect: (cp: CPWithPlayer) => void
  onClose: () => void
}) {
  const eligible = players
    .filter(cp => !usedIds.has(cp.player_id) && (
      slot.pos === 'GK' ? cp.player.position === 'GK' : cp.player.position !== 'GK'
    ))
    .sort((a, b) => b.player.market_value - a.player.market_value)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="bg-pitch border-t border-card-border rounded-t-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-card-border">
          <h3 className="font-display font-bold text-white text-lg">
            Choisir {slot.label}
          </h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {eligible.map(cp => (
            <button key={cp.id} onClick={() => { onSelect(cp); onClose() }}
              className="player-card w-full text-left flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-xs border',
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
          {!eligible.length && (
            <p className="text-gray-500 text-center py-6 font-body">Aucun joueur disponible</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  club: Club
  gameweek: number
  players: CPWithPlayer[]
  existingLineup: any
  gwStarted: boolean
  myMatch: any
}

export default function MatchClient({ club, gameweek, players, existingLineup, gwStarted, myMatch }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [formation, setFormation] = useState<Formation>(existingLineup?.formation ?? '4-3-3')
  const [starters, setStarters] = useState<(CPWithPlayer | null)[]>(() => {
    if (!existingLineup?.lineup_players) return new Array(11).fill(null)
    const lp = existingLineup.lineup_players.filter((p: any) => p.starter)
    return lp.map((e: any) => players.find(p => p.player_id === e.player_id) ?? null)
      .concat(new Array(Math.max(0, 11 - lp.length)).fill(null))
  })
  const [bench, setBench] = useState<CPWithPlayer[]>(() => {
    if (!existingLineup?.lineup_players) return []
    return existingLineup.lineup_players
      .filter((p: any) => !p.starter)
      .sort((a: any, b: any) => a.bench_order - b.bench_order)
      .map((e: any) => players.find(p => p.player_id === e.player_id))
      .filter(Boolean) as CPWithPlayer[]
  })
  const [picking, setPicking] = useState<number | null>(null)
  const [addingBench, setAddingBench] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const layout = FORMATION_LAYOUT[formation]
  const usedIds = new Set([
    ...starters.filter(Boolean).map(p => p!.player_id),
    ...bench.map(p => p.player_id),
  ])
  const starterCount = starters.filter(Boolean).length
  const isComplete = starterCount === 11

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  function changeFormation(f: Formation) {
    setFormation(f)
    // Garder les joueurs sélectionnés mais réinitialiser les positions
    const current = starters.filter(Boolean) as CPWithPlayer[]
    const newStarters: (CPWithPlayer | null)[] = new Array(FORMATION_LAYOUT[f].length).fill(null)
    current.forEach((cp, i) => { if (i < newStarters.length) newStarters[i] = cp })
    setStarters(newStarters)
  }

  async function saveLineup() {
    if (!isComplete) { showToast('Sélectionne 11 titulaires'); return }
    setSaving(true)
    try {
      const { data: lu } = await supabase
        .from('lineups')
        .upsert({ club_id: club.id, gameweek, formation, locked: gwStarted }, { onConflict: 'club_id,gameweek' })
        .select().single()

      await supabase.from('lineup_players').delete().eq('lineup_id', lu.id)
      await supabase.from('lineup_players').insert([
        ...starters.filter(Boolean).map(cp => ({
          lineup_id: lu.id, player_id: cp!.player_id, starter: true, bench_order: null,
        })),
        ...bench.map((cp, i) => ({
          lineup_id: lu.id, player_id: cp.player_id, starter: false, bench_order: i + 1,
        })),
      ])
      showToast('✅ Composition validée')
      router.refresh()
    } catch { showToast('Erreur lors de la sauvegarde') }
    setSaving(false)
  }

  // ── Résultat si journée traitée ───────────────────────────
  if (myMatch?.processed) {
    const hc = Array.isArray(myMatch.home_club) ? myMatch.home_club[0] : myMatch.home_club
    const ac = Array.isArray(myMatch.away_club) ? myMatch.away_club[0] : myMatch.away_club
    const isHome = hc?.id === club.id
    const myScore  = isHome ? myMatch.home_score : myMatch.away_score
    const oppScore = isHome ? myMatch.away_score : myMatch.home_score
    const oppName  = isHome ? ac?.name : hc?.name
    const result   = myScore > oppScore ? 'V' : myScore < oppScore ? 'D' : 'N'
    return (
      <div className="page max-w-lg mx-auto">
        <div className={cn('player-card text-center py-8 mb-4',
          result === 'V' ? 'border-grass/40 bg-grass/5' :
          result === 'D' ? 'border-red-700/40 bg-red-900/5' : 'border-trophy/40 bg-trophy/5')}>
          <p className="text-gray-400 text-xs font-body uppercase tracking-widest mb-3">J{gameweek} · Résultat</p>
          <div className="flex items-center justify-around mb-3">
            <div>
              <p className="font-display font-bold text-grass text-lg">{club.name}</p>
              <p className="font-display font-bold text-6xl text-white mt-1">{Math.round(myScore / 10)}</p>
            </div>
            <div className="text-center">
              <p className="text-4xl">{result === 'V' ? '🏆' : result === 'D' ? '❌' : '🤝'}</p>
              <p className={cn('font-display font-bold text-lg mt-1',
                result === 'V' ? 'text-grass' : result === 'D' ? 'text-red-400' : 'text-trophy')}>
                {result === 'V' ? 'Victoire' : result === 'D' ? 'Défaite' : 'Nul'}
              </p>
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg">{oppName}</p>
              <p className="font-display font-bold text-6xl text-gray-400 mt-1">{Math.round(oppScore / 10)}</p>
            </div>
          </div>
          <p className="text-gray-600 text-xs font-body">Scores fantômes : {myScore.toFixed(1)} – {oppScore.toFixed(1)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-28">
      {toast && <div className="toast">{toast}</div>}

      {/* Picker drawer */}
      {picking !== null && (
        <PlayerPickerDrawer
          slot={layout[picking]}
          players={players}
          usedIds={usedIds}
          onSelect={cp => {
            setStarters(prev => {
              const n = [...prev]
              n[picking] = cp
              return n
            })
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {addingBench && (
        <PlayerPickerDrawer
          slot={{ pos: 'ATT', label: 'Remplaçant' }}
          players={players}
          usedIds={usedIds}
          onSelect={cp => setBench(prev => bench.length < 7 ? [...prev, cp] : prev)}
          onClose={() => setAddingBench(false)}
        />
      )}

      {/* Formation selector */}
      <div className="pt-2 mb-3">
        {gwStarted ? (
          <div className="flex items-center gap-2 mb-3">
            <Lock size={14} className="text-red-400" />
            <span className="text-red-400 text-sm font-body">Journée en cours — composition verrouillée</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            {FORMATIONS.map(f => (
              <button key={f} onClick={() => changeFormation(f)}
                className={cn('flex-shrink-0 px-3 py-1.5 rounded-xl font-display font-bold text-sm transition-all',
                  formation === f ? 'bg-grass text-pitch' : 'bg-card border border-card-border text-gray-400')}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── TERRAIN ──────────────────────────────────────────── */}
      <div className="relative w-full rounded-2xl overflow-hidden mb-4" style={{ paddingBottom: '145%' }}>
        {/* Pelouse */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/60 via-green-800/40 to-green-900/60">
          {/* Lignes terrain */}
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 145" preserveAspectRatio="none">
            {/* Contour */}
            <rect x="5" y="3" width="90" height="139" fill="none" stroke="white" strokeWidth="0.8" />
            {/* Ligne médiane */}
            <line x1="5" y1="72.5" x2="95" y2="72.5" stroke="white" strokeWidth="0.6" />
            {/* Cercle central */}
            <circle cx="50" cy="72.5" r="12" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Surface réparation haut */}
            <rect x="28" y="3" width="44" height="18" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Surface réparation bas */}
            <rect x="28" y="124" width="44" height="18" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Surface but haut */}
            <rect x="38" y="3" width="24" height="7" fill="none" stroke="white" strokeWidth="0.6" />
            {/* Surface but bas */}
            <rect x="38" y="135" width="24" height="7" fill="none" stroke="white" strokeWidth="0.6" />
          </svg>

          {/* Slots joueurs */}
          {layout.map((slot, i) => (
            <PitchSlot
              key={i}
              slot={slot}
              player={starters[i] ?? null}
              onTap={() => setPicking(i)}
              locked={gwStarted}
            />
          ))}
        </div>
      </div>

      {/* Banc */}
      <div className="player-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-400 text-sm font-body font-medium">Remplaçants ({bench.length}/7)</p>
          {!gwStarted && bench.length < 7 && (
            <button onClick={() => setAddingBench(true)}
              className="text-grass text-xs font-display font-bold">+ Ajouter</button>
          )}
        </div>
        {bench.length === 0 ? (
          <p className="text-gray-600 text-sm font-body">Aucun remplaçant</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {bench.map((cp, i) => (
              <div key={cp.id} className="flex items-center gap-1.5 bg-card border border-card-border rounded-xl px-2 py-1.5">
                <span className="text-gray-500 font-display font-bold text-xs">{i+1}</span>
                <span className="font-display font-bold text-white text-sm">{cp.player.lastname}</span>
                {!gwStarted && (
                  <button onClick={() => setBench(prev => prev.filter((_, j) => j !== i))}>
                    <X size={12} className="text-gray-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note remplacement */}
      <div className="player-card border-grass/20 bg-grass/5 mb-4">
        <p className="text-grass text-xs font-body">
          ⚡ Si un titulaire joue &lt;45 min, le 1er remplaçant entre automatiquement (×0.7)
        </p>
      </div>

      {/* Bouton valider */}
      {!gwStarted && (
        <button onClick={saveLineup} disabled={saving || !isComplete}
          className="btn-primary w-full flex items-center justify-center gap-2 text-lg">
          <CheckCircle size={20} />
          {saving ? '...' : isComplete ? 'Valider la composition' : `${starterCount}/11 titulaires`}
        </button>
      )}
    </div>
  )
}
