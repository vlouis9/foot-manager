'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, ShoppingCart, Trophy, Building2, BarChart3, Package, ListOrdered } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',          icon: BarChart3,    label: 'Club'      },
  { href: '/squad',     icon: Users,        label: 'Effectif'  },
  { href: '/matchday',  icon: Trophy,       label: 'Match'     },
  { href: '/results',   icon: ListOrdered,  label: 'Résultats' },
  { href: '/market',    icon: ShoppingCart, label: 'Mercato'   },
  { href: '/standings', icon: BarChart3,    label: 'Classement'},
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="nav-bar">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn('nav-item', active && 'active')}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
