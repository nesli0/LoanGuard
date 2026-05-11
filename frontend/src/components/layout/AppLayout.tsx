import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuthStore } from '@/store/authStore'
import api from '@/api/axios'

export function AppLayout() {
  const { token } = useAuthStore()
  const { pathname } = useLocation()

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ['profile-check'],
    queryFn: async () => {
      try {
        const res = await api.get('/profile')
        return res.data.data
      } catch (err: any) {
        if (err.response?.status === 404) return null
        throw err
      }
    },
    retry: false,
    enabled: !!token
  })

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D9CDB]" />
      </div>
    )
  }

  // Profil oluşturulmuş olsa bile içi boşsa (örn: first_name yoksa) zorunlu yönlendir
  const isProfileIncomplete = profileRes && !profileRes.first_name;
  if (isProfileIncomplete && pathname !== '/profile') {
    return <Navigate to="/profile" replace state={{ requiresProfile: true }} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

