/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        pitch:   { DEFAULT: '#0a0f0d', 50: '#f0faf4', 900: '#0a0f0d' },
        grass:   { DEFAULT: '#22c55e', 400: '#4ade80', 600: '#16a34a' },
        trophy:  { DEFAULT: '#f59e0b', 300: '#fcd34d', 700: '#b45309' },
        card:    { DEFAULT: '#111a14', border: '#1e2d22' },
      },
      fontFamily: {
        display: ['var(--font-barlow)', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
      },
      backgroundImage: {
        'pitch-grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        'card-reveal': 'cardReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up':    'slideUp 0.3s ease-out',
        'pulse-green': 'pulseGreen 2s infinite',
      },
      keyframes: {
        cardReveal: {
          '0%':   { transform: 'scale(0.8) rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotateY(0deg)',    opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(34,197,94,0)' },
        },
      },
    },
  },
  plugins: [],
}
