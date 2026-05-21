'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState<'login' | 'register'>('login')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const fn = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })
    const { error } = await fn
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-pitch">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="w-20 h-20 rounded-2xl bg-grass/10 border border-grass/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">⚽</span>
        </div>
        <h1 className="font-display font-bold text-4xl uppercase tracking-wider text-white">
          Foot Manager
        </h1>
        <p className="text-gray-500 text-sm mt-1 font-body">Directeur Sportif Ligue 1</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-card border border-card-border rounded-xl p-1 mb-6 w-full max-w-sm">
        {(['login', 'register'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all ${
              mode === m ? 'bg-grass text-pitch' : 'text-gray-400'
            }`}
          >
            {m === 'login' ? 'Connexion' : 'Inscription'}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="w-full max-w-sm space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-card border border-card-border rounded-xl px-4 py-3 text-white placeholder-gray-600 font-body text-sm focus:outline-none focus:border-grass/60"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full bg-card border border-card-border rounded-xl px-4 py-3 text-white placeholder-gray-600 font-body text-sm focus:outline-none focus:border-grass/60"
        />
        {error && (
          <p className="text-red-400 text-xs font-body px-1">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="btn-primary w-full"
        >
          {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </div>
    </div>
  )
}
