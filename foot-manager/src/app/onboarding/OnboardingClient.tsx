'use client'
import { useState } from 'react'
import { CLUB_CONFIGS } from '@/types'
import type { Player } from '@/types'
import { createPlayerClub, drawDraftCards, exchangePlayer, finalizeDraft } from '@/lib/actions/onboarding'
import { formatMoney } from '@/lib/utils'
import { useRouter } from 'next/navigation'

// ─── Données visuelles des clubs ──────────────────────────────
const CLUB_TIERS: Record<string, { tier: string; color: string }> = {
  'PSG':        { tier: 'Élite',    color: 'border-purple-500/60 bg-purple-900/20' },
  'Monaco':     { tier: 'Top',      color: 'border-red-500/60 bg-red-900/20' },
  'Marseille':  { tier: 'Top',      color: 'border-sky-500/60 bg-sky-900/20' },
  'Lyon':       { tier: 'Top',      color: 'border-blue-500/60 bg-blue-900/20' },
  'Lille':      { tier: 'Solide',   color: 'border-red-700/60 bg-red-900/10' },
  'Nice':       { tier: 'Solide',   color: 'border-red-400/60 bg-red-900/10' },
  'Lens':       { tier: 'Solide',   color: 'border-yellow-600/60 bg-yellow-900/10' },
  'Rennes':     { tier: 'Solide',   color: 'border-red-800/60 bg-red-900/10' },
  'Strasbourg': { tier: 'Milieu',   color: 'border-blue-700/60 bg-blue-900/10' },
  'Nantes':     { tier: 'Milieu',   color: 'border-yellow-500/60 bg-yellow-900/10' },
  'Toulouse':   { tier: 'Milieu',   color: 'border-violet-600/60 bg-violet-900/10' },
  'Brest':      { tier: 'Milieu',   color: 'border-orange-600/60 bg-orange-900/10' },
  'Lorient':    { tier: 'Outsider', color: 'border-orange-800/60 bg-orange-900/10' },
  'Le Havre':   { tier: 'Outsider', color: 'border-sky-700/60 bg-sky-900/10' },
  'Auxerre':    { tier: 'Outsider', color: 'border-white/20 bg-white/5' },
  'Angers':     { tier: 'Outsider', color: 'border-white/20 bg-white/5' },
  'Paris FC':   { tier: 'Défi',     color: 'border-blue-900/60 bg-blue-900/10' },
  'Metz':       { tier: 'Défi',     color: 'border-yellow-700/60 bg-yellow-900/10' },
}

// ─── Étape 1 : Choix du club ───────────────────────────────────
function ClubSelector({ onSelect }: { onSelect: (name: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const tiers = ['Élite', 'Top', 'Solide', 'Milieu', 'Outsider', 'Défi']

  async function confirm() {
    if (!selected) return
    setLoading(true)
    onSelect(selected)
  }

  return (
    <div className="page max-w-lg mx-auto">
      <div className="text-center mb-8 pt-4">
        <h1 className="section-title text-3xl mb-2">Choisis ton club</h1>
        <p className="text-gray-400 text-sm font-body">
          Budget plus élevé = club plus faible au départ
        </p>
      </div>

      {tiers.map(tier => {
        const clubs = Object.entries(CLUB_CONFIGS).filter(
          ([name]) => CLUB_TIERS[name]?.tier === tier
        )
        return (
          <div key={tier} className="mb-5">
            <p className="text-xs font-display font-bold uppercase tracking-widest text-gray-500 mb-2 px-1">
              {tier}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {clubs.map(([name, config]) => (
                <button
                  key={name}
                  onClick={() => setSelected(name)}
                  className={`player-card text-left transition-all ${
                    CLUB_TIERS[name]?.color
                  } ${selected === name ? 'ring-2 ring-grass' : ''}`}
                >
                  <p className="font-display font-bold text-base text-white">{name}</p>
                  <p className="text-grass text-sm font-body mt-0.5">
                    {formatMoney(config.initial_budget)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <div className="sticky bottom-24 pt-4">
        <button
          onClick={confirm}
          disabled={!selected || loading}
          className="btn-primary w-full text-lg"
        >
          {loading ? '...' : selected ? `Choisir ${selected}` : 'Sélectionne un club'}
        </button>
      </div>
    </div>
  )
}

// ─── Badge position ───────────────────────────────────────────
function PosBadge({ pos }: { pos: string }) {
  const colors: Record<string, string> = {
    GK: 'bg-yellow-900/60 text-yellow-300',
    DEF: 'bg-blue-900/60 text-blue-300',
    MID: 'bg-green-900/60 text-green-300',
    ATT: 'bg-red-900/60 text-red-300',
  }
  return (
    <span className={`text-xs font-display font-bold px-2 py-0.5 rounded-md ${colors[pos] ?? 'bg-gray-800 text-gray-300'}`}>
      {pos}
    </span>
  )
}

// ─── Étape 2 : Draft des 25 cartes ───────────────────────────
function DraftScreen({
  cards,
  myPlayers,
  clubId,
  userId,
  onDone,
}: {
  cards: Player[]
  myPlayers: Player[]
  clubId: string
  userId: string
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [showExchange, setShowExchange] = useState(false)
  const [loading, setLoading] = useState(false)
  const [kept, setKept] = useState(0)
  const [squad, setSquad] = useState<Player[]>(myPlayers)

  const current = cards[index]
  const done = index >= cards.length

  async function handleRefuse() {
    if (index + 1 >= cards.length) { await finalize(); return }
    setIndex(i => i + 1)
  }

  async function handleKeep(givenPlayer: Player) {
    setLoading(true)
    try {
      await exchangePlayer(clubId, current.id, givenPlayer.id)
      setSquad(s => s.filter(p => p.id !== givenPlayer.id).concat(current))
      setKept(k => k + 1)
      setShowExchange(false)
      if (index + 1 >= cards.length) { await finalize(); return }
      setIndex(i => i + 1)
    } catch (e) {
      alert('Erreur lors de l\'échange')
    }
    setLoading(false)
  }

  async function finalize() {
    await finalizeDraft(userId)
    onDone()
  }

  if (done) {
    return (
      <div className="page flex flex-col items-center justify-center text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="section-title mb-2">Draft terminé !</h2>
        <p className="text-gray-400 font-body mb-6">{kept} joueur{kept > 1 ? 's' : ''} récupéré{kept > 1 ? 's' : ''}</p>
        <button onClick={finalize} className="btn-primary">Voir mon effectif</button>
      </div>
    )
  }

  return (
    <div className="page max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-6 pt-2">
        <p className="text-gray-500 text-sm font-body mb-1">Carte {index + 1} / {cards.length}</p>
        <div className="w-full bg-card-border rounded-full h-1">
          <div
            className="bg-grass h-1 rounded-full transition-all"
            style={{ width: `${((index) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Carte révélée */}
      {!showExchange ? (
        <div className="animate-card-reveal">
          <div className="player-card border-trophy/40 bg-trophy/5 p-6 text-center mb-6">
            <PosBadge pos={current.position} />
            <h2 className="font-display font-bold text-3xl text-white mt-3 mb-1">
              {current.lastname}
            </h2>
            <p className="text-gray-400 font-body text-sm">{current.real_team}</p>
            <div className="flex justify-center gap-4 mt-4">
              <div className="stat-pill">
                <span>💰</span>
                <span>{formatMoney(current.market_value)}</span>
              </div>
              <div className="stat-pill">
                <span>📅</span>
                <span>{current.age} ans</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRefuse}
              className="btn-secondary flex-1"
            >
              ✕ Refuser
            </button>
            <button
              onClick={() => setShowExchange(true)}
              className="btn-primary flex-1"
            >
              ✓ Garder
            </button>
          </div>
        </div>
      ) : (
        /* Choix du joueur à céder */
        <div className="animate-slide-up">
          <div className="mb-4">
            <h3 className="font-display font-bold text-lg text-white mb-1">
              Qui cédes-tu pour {current.lastname} ?
            </h3>
            <p className="text-gray-500 text-xs font-body">
              Ce joueur rejoint le club de {current.real_team}
            </p>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {squad.map(p => (
              <button
                key={p.id}
                onClick={() => handleKeep(p)}
                disabled={loading}
                className="player-card w-full flex items-center justify-between active:bg-red-900/20"
              >
                <div className="flex items-center gap-3">
                  <PosBadge pos={p.position} />
                  <span className="font-display font-bold text-white">{p.lastname}</span>
                </div>
                <span className="text-gray-400 text-sm font-body">{formatMoney(p.market_value)}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowExchange(false)}
            className="btn-secondary w-full mt-3"
          >
            ← Annuler
          </button>
        </div>
      )}

      {/* Skip tout */}
      {!showExchange && (
        <button
          onClick={finalize}
          className="text-gray-600 text-xs font-body text-center w-full mt-6"
        >
          Passer le reste du draft →
        </button>
      )}
    </div>
  )
}

// ─── Page principale Onboarding ───────────────────────────────
export default function OnboardingPage({
  userId,
}: {
  userId: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<'club' | 'draft'>('club')
  const [clubId, setClubId] = useState<string | null>(null)
  const [clubName, setClubName] = useState<string | null>(null)
  const [draftCards, setDraftCards] = useState<Player[]>([])
  const [myPlayers, setMyPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)

  async function handleClubSelect(name: string) {
    setLoading(true)
    try {
      const club = await createPlayerClub(name)
      setClubId(club.id)
      setClubName(name)

      // Charger les joueurs du club pour le draft
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: cp } = await supabase
        .from('club_players')
        .select('player_id, players(*)')
        .eq('club_id', club.id)
      setMyPlayers(cp?.map((c: any) => c.players) ?? [])

      // Tirer les 25 cartes
      const cards = await drawDraftCards(club.id)
      setDraftCards(cards)
      setStep('draft')
    } catch (e) {
      alert('Erreur lors de la création du club')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-grass border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-body">Préparation du draft...</p>
        </div>
      </div>
    )
  }

  if (step === 'draft' && clubId && myPlayers.length > 0) {
    return (
      <DraftScreen
        cards={draftCards}
        myPlayers={myPlayers}
        clubId={clubId}
        userId={userId}
        onDone={() => router.push('/squad')}
      />
    )
  }

  return <ClubSelector onSelect={handleClubSelect} />
}
