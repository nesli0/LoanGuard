import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, AlertCircle } from 'lucide-react'
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

import api from '@/api/axios'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { StatCard } from '@/components/shared/StatCard'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse, HealthScore, Alert, BudgetPeriod } from '@/types'

export function DashboardPage() {
  const queryClient = useQueryClient()

  // 1. Fetch Health Score
  const { data: analysisRes, isLoading: isAnalysisLoading } = useQuery({
    queryKey: ['budget-analysis'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<HealthScore>>('/budget/analysis')
      return res.data.data
    },
  })

  // 2. Fetch Active Alerts
  const { data: alertsRes, isLoading: isAlertsLoading } = useQuery({
    queryKey: ['alerts-active'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Alert[]>>('/alerts/?include_dismissed=false')
      return res.data.data
    },
  })

  // 3. Fetch Latest Budget for Pie Chart Categories (Gider Dağılımı)
  const { data: latestBudgetRes, isLoading: isBudgetLoading } = useQuery({
    queryKey: ['budget-latest'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BudgetPeriod>>('/budget/latest')
      return res.data.data
    },
  })

  // Dismiss Alert Mutation
  const dismissAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}/dismiss`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-active'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-unread'] })
    },
  })

  const isLoading = isAnalysisLoading || isAlertsLoading || isBudgetLoading

  // Data processing for charts
  const healthData = analysisRes ? [{ name: 'Skor', value: analysisRes.score, fill: getScoreColor(analysisRes.score) }] : []
  
  const barChartData = analysisRes ? [
    {
      name: 'Bu Ay',
      Gelir: analysisRes.details.total_income as number,
      Gider: analysisRes.details.total_expense as number,
    }
  ] : []

  const pieChartData = useMemo(() => {
    if (!latestBudgetRes?.entries) return []
    const expenses = latestBudgetRes.entries.filter(e => e.type === 'expense')
    const grouped: Record<string, number> = {}
    expenses.forEach(e => {
      grouped[e.category] = (grouped[e.category] || 0) + e.amount
    })
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5) // top 5
  }, [latestBudgetRes])

  const PIE_COLORS = ['#0A2540', '#2D9CDB', '#059669', '#D97706', '#DC2626']

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="cards" cards={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LoadingSkeleton type="form" rows={1} />
          <LoadingSkeleton type="form" rows={1} />
          <LoadingSkeleton type="form" rows={1} />
        </div>
      </div>
    )
  }

  const alerts = alertsRes?.filter(a => a.level === 'danger') || []
  const details = analysisRes?.details as any

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-300">
      
      {/* 1. Alert Banners (Sadece danger/red olanlar) */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-3">
          {alerts.map(alert => (
            <div key={alert.id} className="relative flex items-start gap-3 bg-[#FEF2F2] border-l-4 border-[#DC2626] p-4 rounded-r-md shadow-sm">
              <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="flex-1 pr-8">
                <h4 className="text-sm font-semibold text-[#991B1B]">{alert.title}</h4>
                <p className="text-sm text-[#991B1B]/90 mt-0.5">{alert.message}</p>
              </div>
              <button 
                onClick={() => dismissAlertMutation.mutate(alert.id)}
                className="absolute right-4 top-4 text-[#DC2626]/60 hover:text-[#DC2626] transition-colors"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 2. Stat Kartları */}
      {analysisRes && details && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Toplam Gelir"
            value={formatCurrency(details.total_income)}
            color="success"
          />
          <StatCard
            label="Toplam Gider"
            value={formatCurrency(details.total_expense)}
            color="danger"
          />
          <StatCard
            label="Net Tasarruf"
            value={formatCurrency(details.total_savings)}
            color="default" // default navy text
          />
          <StatCard
            label="DTI Oranı"
            value={formatPercent(analysisRes.dti_ratio / 100)} // backend sends 15.0 for 15%
            color="accent"
          />
        </div>
      )}

      {/* 3. Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sol - Sağlık Skoru */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 flex flex-col items-center justify-center min-h-[320px]">
          <h3 className="text-sm font-semibold text-[#0F172A] w-full text-left mb-2">Finansal Sağlık Skoru</h3>
          {analysisRes ? (
            <div className="relative w-full h-[220px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  cx="50%" 
                  cy="70%" 
                  innerRadius="80%" 
                  outerRadius="100%" 
                  barSize={16} 
                  data={healthData} 
                  startAngle={180} 
                  endAngle={0}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    background={{ fill: '#F1F5F9' }}
                    dataKey="value"
                    cornerRadius={8}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <span className="text-4xl font-extrabold text-[#0F172A] tabular-nums tracking-tight">
                  {analysisRes.score.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-[#64748B]">/100</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#64748B]">Veri yok</div>
          )}
        </div>

        {/* Orta - Gelir & Gider */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 min-h-[320px] flex flex-col">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-6">Gelir ve Gider</h3>
          {barChartData.length > 0 ? (
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `₺${val / 1000}k`} />
                  <RechartsTooltip 
                    formatter={(value: any) => formatCurrency(value as number)}
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  <Bar dataKey="Gelir" fill="#0A2540" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="Gider" fill="#2D9CDB" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#64748B]">Veri yok</div>
          )}
        </div>

        {/* Sağ - Gider Dağılımı */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 min-h-[320px] flex flex-col">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Gider Dağılımı</h3>
          {pieChartData.length > 0 ? (
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: any) => formatCurrency(value as number)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col gap-2">
              <span className="text-sm text-[#64748B]">Gider verisi bulunamadı.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function getScoreColor(score: number) {
  if (score >= 70) return '#059669' // success green
  if (score >= 40) return '#D97706' // warning yellow/amber
  return '#DC2626' // danger red
}
