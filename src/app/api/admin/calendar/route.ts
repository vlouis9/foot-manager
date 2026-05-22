import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function parseCSV(csv: string) {
  const lines = csv.trim().split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => obj[h] = values[i] ?? '')
    return obj
  })
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { csv } = await req.json()

  if (!csv?.trim()) {
    return NextResponse.json({ error: 'CSV vide' }, { status: 400 })
  }

  try {
    const rows = parseCSV(csv)
    const inserts = rows
      .filter(r => r.gameweek && r.date && r.home_team && r.away_team)
      .map(r => ({
        gameweek: parseInt(r.gameweek),
        match_date: new Date(r.date).toISOString(),
        home_team: r.home_team,
        away_team: r.away_team,
      }))

    if (!inserts.length) {
      return NextResponse.json({ error: 'Aucune ligne valide trouvée' }, { status: 400 })
    }

    // Supprimer l'ancien calendrier
    await supabase.from('calendar').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { error } = await supabase.from('calendar').insert(inserts)
    if (error) throw error

    return NextResponse.json({
      message: `✅ ${inserts.length} matchs importés sur ${new Set(inserts.map(i => i.gameweek)).size} journées`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE() {
  const supabase = createServerSupabaseClient()
  await supabase.from('calendar').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  return NextResponse.json({ message: '✅ Calendrier réinitialisé' })
}
