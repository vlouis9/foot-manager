import { create } from 'zustand'
import type { Club, ClubPlayer, ClubUpgrade, Player } from '@/types'

// ─── Club Store ────────────────────────────────────────────────
interface ClubState {
  club: Club | null
  upgrades: ClubUpgrade[]
  currentGameweek: number
  setClub: (club: Club) => void
  setUpgrades: (upgrades: ClubUpgrade[]) => void
  setGameweek: (gw: number) => void
  updateBudget: (amount: number) => void
}

export const useClubStore = create<ClubState>(set => ({
  club: null,
  upgrades: [],
  currentGameweek: 1,
  setClub: club => set({ club }),
  setUpgrades: upgrades => set({ upgrades }),
  setGameweek: gw => set({ currentGameweek: gw }),
  updateBudget: amount => set(s => s.club
    ? { club: { ...s.club, budget: s.club.budget + amount } }
    : {}
  ),
}))

// ─── Squad Store ───────────────────────────────────────────────
interface SquadState {
  players: (ClubPlayer & { player: Player })[]
  setPlayers: (players: (ClubPlayer & { player: Player })[]) => void
  addPlayer: (cp: ClubPlayer & { player: Player }) => void
  removePlayer: (playerId: string) => void
  updateXp: (playerId: string, xp: number, level: number) => void
}

export const useSquadStore = create<SquadState>(set => ({
  players: [],
  setPlayers: players => set({ players }),
  addPlayer: cp => set(s => ({ players: [...s.players, cp] })),
  removePlayer: playerId => set(s => ({
    players: s.players.filter(p => p.player_id !== playerId)
  })),
  updateXp: (playerId, xp, level) => set(s => ({
    players: s.players.map(p =>
      p.player_id === playerId ? { ...p, xp, level } : p
    )
  })),
}))

// ─── Onboarding Store ─────────────────────────────────────────
interface DraftCard {
  player: Player
  decision: 'keep' | 'refuse' | 'pending'
  exchangedPlayerId?: string
}

interface OnboardingState {
  step: 'club_select' | 'draft' | 'done'
  selectedClub: string | null
  draftCards: DraftCard[]
  currentCardIndex: number
  setStep: (step: OnboardingState['step']) => void
  setSelectedClub: (name: string) => void
  setDraftCards: (cards: Player[]) => void
  decideDraft: (index: number, decision: 'keep' | 'refuse', exchangedPlayerId?: string) => void
  nextCard: () => void
}

export const useOnboardingStore = create<OnboardingState>(set => ({
  step: 'club_select',
  selectedClub: null,
  draftCards: [],
  currentCardIndex: 0,
  setStep: step => set({ step }),
  setSelectedClub: name => set({ selectedClub: name }),
  setDraftCards: cards => set({
    draftCards: cards.map(p => ({ player: p, decision: 'pending' })),
    currentCardIndex: 0,
  }),
  decideDraft: (index, decision, exchangedPlayerId) => set(s => ({
    draftCards: s.draftCards.map((c, i) =>
      i === index ? { ...c, decision, exchangedPlayerId } : c
    )
  })),
  nextCard: () => set(s => ({ currentCardIndex: s.currentCardIndex + 1 })),
}))
