import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BellRing, Check, X, BellOff, Loader2 } from 'lucide-react'

import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse, Alert } from '@/types'

export function AlertsPage() {
  const queryClient = useQueryClient()
  const [showAll, setShowAll] = useState(false)

  const { data: alertsRes, isLoading } = useQuery({
    queryKey: ['alerts', showAll],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Alert[]>>(`/alerts/?include_dismissed=${showAll}`)
      return res.data.data
    },
  })

  const readMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/alerts/${id}/read`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] }) // Header update
    }
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/alerts/${id}/dismiss`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] })
    }
  })

  if (isLoading) return <LoadingSkeleton type="table" rows={6} />

  const alerts = alertsRes || []

  const getBorderColor = (level: string) => {
    switch (level) {
      case 'danger': return 'border-l-[#DC2626]'
      case 'warning': return 'border-l-[#D97706]'
      case 'info':
      case 'success':
      default: return 'border-l-[#059669]'
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EFF8FF] flex items-center justify-center">
            <BellRing className="w-5 h-5 text-[#2D9CDB]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Uyarılar</h1>
            <p className="text-sm text-[#64748B]">Finansal durumunuzla ilgili önemli bildirimler.</p>
          </div>
        </div>
        <div className="flex bg-[#F1F5F9] p-1 rounded-md">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-all ${!showAll ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
          >
            Sadece Aktif
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-all ${showAll ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'}`}
          >
            Tümünü Göster
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-[#CBD5E1]">
            <BellOff className="w-12 h-12 text-[#94A3B8] mb-4" />
            <h3 className="text-lg font-medium text-[#0F172A]">Hiç uyarı yok</h3>
            <p className="text-sm text-[#64748B] mt-1">Şu an için her şey yolunda görünüyor.</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div 
              key={alert.id} 
              className={`bg-white border-l-[3px] border-y border-r border-[#E2E8F0] p-4 sm:p-5 rounded-r-lg shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all
                ${getBorderColor(alert.level)}
                ${alert.is_read ? 'opacity-60 bg-gray-50' : 'bg-white'}
                ${alert.is_dismissed ? 'grayscale opacity-40' : ''}
              `}
            >
              <div className="flex-1 space-y-1">
                <h3 className={`text-base font-semibold text-[#0F172A] ${alert.is_dismissed ? 'line-through text-[#64748B]' : ''}`}>
                  {alert.title}
                </h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{alert.message}</p>
                <div className="text-[10px] font-medium text-[#94A3B8] pt-2 uppercase tracking-wider">
                  {new Date(alert.triggered_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {!alert.is_read && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => readMutation.mutate(alert.id)}
                    disabled={readMutation.isPending}
                    className="h-8 text-xs font-medium border-[#E2E8F0] hover:bg-[#F8FAFC]"
                  >
                    {readMutation.isPending && readMutation.variables === alert.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                    Okundu İşaretle
                  </Button>
                )}
                {!alert.is_dismissed && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => dismissMutation.mutate(alert.id)}
                    disabled={dismissMutation.isPending}
                    className="h-8 text-xs font-medium text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                  >
                    {dismissMutation.isPending && dismissMutation.variables === alert.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    Kapat
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
