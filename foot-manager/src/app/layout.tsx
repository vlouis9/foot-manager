import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BottomNav } from '@/components/ui/BottomNav'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Foot Manager',
  description: 'Directeur sportif Ligue 1',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Foot Manager' },
}

export const viewport: Viewport = {
  themeColor: '#0a0f0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <html lang="fr">
      <body>
        <main className="relative z-10">
          {children}
        </main>
        {session && <BottomNav />}
      </body>
    </html>
  )
}
