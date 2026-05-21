'use server'
import { generateTestStats, processGameweek } from '@/lib/actions/matchday'

export async function runSimulation(gameweek: number) {
  const count = await generateTestStats(gameweek)
  const result = await processGameweek(gameweek)
  return { count, processed: result.processed }
}
