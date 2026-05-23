import type { Metadata, Viewport } from 'next'
import './globals.css'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Foot Manager',
  description: 'Directeur Sportif Ligue 1',
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
  return (
    <html lang="fr">
      <body>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
