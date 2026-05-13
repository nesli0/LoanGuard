import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react'

import api from '@/api/axios'
import { formatCurrency, formatPercent, getMonthName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/StatCard'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ApiResponse } from '@/types'

interface ReportData {
  id: string
  month: number
  year: number
  health_score: number
  savings_rate: number
  dti_ratio: number
  total_income: number
  total_expense: number
  insights: string[]
  created_at: string
}

export function ReportPage() {
  const queryClient = useQueryClient()
  const today = new Date()
  
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  const { data: reportRes, isLoading, isError } = useQuery({
    queryKey: ['report', currentYear, currentMonth],
    queryFn: async () => {
      try {
        const res = await api.get<ApiResponse<ReportData>>(`/report/${currentYear}/${currentMonth}`)
        return res.data.data
      } catch (err: any) {
        if (err.response?.status === 404) return null
        throw err
      }
    },
    retry: false
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<ReportData>>('/report/generate', { month: currentMonth, year: currentYear })
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', currentYear, currentMonth] })
    }
  })

  const handlePrevMonth = () => {
    let m = currentMonth - 1
    let y = currentYear
    if (m < 1) { m = 12; y -= 1 }
    setCurrentMonth(m)
    setCurrentYear(y)
  }

  const handleNextMonth = () => {
    let m = currentMonth + 1
    let y = currentYear
    if (m > 12) { m = 1; y += 1 }
    setCurrentMonth(m)
    setCurrentYear(y)
  }

  if (isLoading) return <LoadingSkeleton type="cards" cards={4} />

  const report = reportRes

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Aylık Finansal Rapor</h1>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] p-1">
            <button onClick={handlePrevMonth} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-[#64748B] transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold w-28 text-center text-[#0F172A]">
              {getMonthName(currentMonth)} {currentYear}
            </span>
            <button onClick={handleNextMonth} className="p-1.5 rounded-md hover:bg-white hover:shadow-sm text-[#64748B] transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <Button 
            onClick={() => generateMutation.mutate()} 
            disabled={generateMutation.isPending}
            className="bg-[#0A2540] hover:bg-[#1B4F8A]"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Rapor Oluştur
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>Rapor bilgisi çekilirken bir hata oluştu.</AlertDescription>
        </Alert>
      )}

      {generateMutation.isError && (
        <Alert variant="warning" className="bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]">
          <AlertDescription>Rapor oluşturulamadı. (Bu ay için yeterli bütçe verisi olmayabilir).</AlertDescription>
        </Alert>
      )}

      {/* İçerik */}
      {!report && !isLoading && !isError && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-dashed border-[#CBD5E1]">
          <FileText className="w-12 h-12 text-[#94A3B8] mb-4" />
          <h3 className="text-lg font-medium text-[#0F172A]">Bu ay için henüz rapor oluşturulmadı</h3>
          <p className="text-sm text-[#64748B] mt-1 mb-6 max-w-sm text-center">Bütçe verilerinizi baz alarak finansal sağlığınızı ve yapay zeka tavsiyelerini görmek için rapor oluşturun.</p>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="bg-[#2D9CDB] hover:bg-[#1B84C3]">
            {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Oluşturuluyor...</> : 'Rapor Oluştur'}
          </Button>
        </div>
      )}

      {report && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Özet Kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Sağlık Skoru"
              value={`${report.health_score.toFixed(1)} / 100`}
              color={report.health_score >= 70 ? 'success' : report.health_score >= 40 ? 'warning' : 'danger'}
            />
            <StatCard
              label="Tasarruf Oranı"
              value={formatPercent(report.savings_rate / 100)}
              color="accent"
            />
            <StatCard
              label="DTI Oranı"
              value={formatPercent(report.dti_ratio / 100)}
              color={report.dti_ratio > 40 ? 'danger' : 'success'}
            />
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Aylık Nakit Akışı</span>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-sm font-bold text-[#059669]">{formatCurrency(report.total_income)}</span>
                <span className="text-sm font-bold text-[#DC2626]">{formatCurrency(report.total_expense)}</span>
              </div>
              <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden flex">
                <div className="bg-[#059669] h-full" style={{ width: `${(report.total_income / (report.total_income + report.total_expense || 1)) * 100}%` }} />
                <div className="bg-[#DC2626] h-full flex-1" />
              </div>
            </div>
          </div>

          {/* Insights (Analizler) */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-[#0F172A] mb-4">Yapay Zeka Değerlendirmesi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.insights.map((insight: string, idx: number) => (
                <div key={idx} className="flex gap-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-[#EFF8FF] flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4 text-[#2D9CDB]" />
                  </div>
                  <p className="text-sm text-[#0F172A] leading-relaxed pt-1.5">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-right text-xs text-[#94A3B8] italic">
            Bu rapor {new Date(report.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} tarihinde oluşturuldu.
          </div>

        </div>
      )}

    </div>
  )
}
