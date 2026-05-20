'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, ShoppingCart, Trophy, Building2, BarChart3, Package } from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { href: '/',          icon: BarChart3,    label: 'Club'      },
  { href: '/squad',     icon: Users,        label: 'Effectif'  },
  { href: '/matchday',  icon: Trophy,       label: 'Match'     },
  { href: '/market',    icon: ShoppingCart, label: 'Mercato'   },
  { href: '/packs',     icon: Package,      label: 'Paquets'   },
  { href: '/standings', icon: BarChart3,    label: 'Classement'},
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="nav-bar">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className={clsx('nav-item', pathname === href && 'active')}
        >
          <Icon size={22} strokeWidth={pathname === href ? 2.5 : 1.8} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
