import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/api/axios'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import type { ApiResponse, Alert } from '@/types'

export function Header() {
  const { user } = useAuthStore()
  const location = useLocation()

  const { data: alertsRes } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Alert[]>>('/alerts/?include_dismissed=false')
      return res.data.data
    },
    refetchInterval: 30000, // 30 saniye
  })

  const unreadCount = alertsRes?.filter(a => !a.is_read).length || 0

  const getPageTitle = () => {
    const path = location.pathname
    if (path.includes('dashboard')) return 'Dashboard'
    if (path.includes('budget')) return 'Bütçe Yönetimi'
    if (path.includes('credit')) return 'Kredi Analizi'
    if (path.includes('goals')) return 'Hedeflerim'
    if (path.includes('simulator')) return 'Simülatör'
    if (path.includes('investment')) return 'Yatırım Profili'
    if (path.includes('chat')) return 'AI Danışman'
    if (path.includes('alerts')) return 'Uyarılar'
    if (path.includes('report')) return 'Aylık Rapor'
    if (path.includes('profile')) return 'Profil Ayarları'
    return 'LoanGuard'
  }

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between sticky top-0 z-30">
      <h2 className="text-lg font-semibold text-[#0F172A]">{getPageTitle()}</h2>
      
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="relative text-[#64748B] hover:text-[#0F172A] border-[#E2E8F0]">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
        
        <div className="flex items-center gap-3 border-l border-[#E2E8F0] pl-4">
          <div className="w-8 h-8 rounded-full bg-[#0A2540] text-white flex items-center justify-center text-sm font-bold shadow-sm">
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-semibold text-[#0F172A] leading-none">{user?.username}</span>
            <span className="text-xs text-[#64748B] mt-1">{user?.email}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
