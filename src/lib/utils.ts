import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M€`
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)}k€`
  return `${amount}€`
}

export function formatRating(rating: number): string {
  return rating.toFixed(1)
}

export function positionColor(position: string): string {
  const map: Record<string, string> = {
    GK:  'text-yellow-300',
    DEF: 'text-blue-300',
    MID: 'text-green-300',
    ATT: 'text-red-300',
  }
  return map[position] ?? 'text-gray-300'
}

export function positionBg(position: string): string {
  const map: Record<string, string> = {
    GK:  'bg-yellow-900/60',
    DEF: 'bg-blue-900/60',
    MID: 'bg-green-900/60',
    ATT: 'bg-red-900/60',
  }
  return map[position] ?? 'bg-gray-800'
}
