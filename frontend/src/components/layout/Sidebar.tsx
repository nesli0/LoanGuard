import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Target,
  Calculator,
  TrendingUp,
  MessageSquare,
  Bell,
  FileText,
  User,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/budget',     label: 'Bütçe',           icon: Wallet },
  { to: '/credit',     label: 'Kredi Analizi',   icon: CreditCard },
  { to: '/goals',      label: 'Hedeflerim',      icon: Target },
  { to: '/simulator',  label: 'Simülatör',       icon: Calculator },
  { to: '/investment', label: 'Yatırım',         icon: TrendingUp },
  { to: '/chat',       label: 'AI Danışman',     icon: MessageSquare },
  { to: '/alerts',     label: 'Uyarılar',        icon: Bell },
  { to: '/report',     label: 'Rapor',           icon: FileText },
  { to: '/profile',    label: 'Profil',          icon: User },
]

export function Sidebar() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-full"
      style={{ background: '#0A2540' }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: '#2D9CDB' }}
          >
            <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">Loan</span>
            <span style={{ color: '#2D9CDB' }}>Guard</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col gap-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/90 transition-all duration-150"
          id="logout-btn"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
}
