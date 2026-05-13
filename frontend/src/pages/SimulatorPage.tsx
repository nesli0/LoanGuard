import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'

import api from '@/api/axios'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { BudgetGuard } from '@/components/shared/BudgetGuard'
import type { ApiResponse } from '@/types'

// Use a custom simple slider that matches the design since shadcn slider wasn't fully created
function Slider({ value, min, max, step, onChange }: { value: number, min: number, max: number, step: number, onChange: (v: number) => void }) {
  return (
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2D9CDB]"
    />
  )
}

export function SimulatorPage() {
  const [amount, setAmount] = useState(100000)
  const [months, setMonths] = useState(24)
  const [interestRate, setInterestRate] = useState(3.5) // %3.5 monthly or annual? Frontend says 1-60.
  const [result, setResult] = useState<any | null>(null)

  // Gelir ve borç bilgisini almak için
  const { data: analysisRes, isLoading: isAnalysisLoading } = useQuery({
    queryKey: ['budget-analysis'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any>>('/budget/analysis')
      return res.data.data
    },
  })

  // Debounced API Call
  useEffect(() => {
    if (!analysisRes) return

    const timer = setTimeout(async () => {
      try {
        const payload = {
          amount,
          months,
          interest_rate: interestRate / 100, // 0.035
          current_income: analysisRes.details.total_income || 1, // avoid division by zero
          current_debt_payments: analysisRes.details.loan_payments || 0,
        }
        const res = await api.post<ApiResponse<any>>('/simulator/loan', payload)
        setResult(res.data.data)
      } catch (error) {
        console.error('Simülasyon hatası:', error)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [amount, months, interestRate, analysisRes])

  if (isAnalysisLoading) return <LoadingSkeleton type="form" rows={4} />

  return (
    <BudgetGuard message="Simülatörü kullanabilmek için önce bütçe bilgilerinizi girmeniz gerekiyor.">
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      
      <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Kredi Simülatörü</h1>
          <p className="text-sm text-[#64748B]">Farklı senaryolarda bütçenizin nasıl etkileneceğini anında görün.</p>
        </div>
        <div className="flex gap-4">
           <div className="space-y-1">
             <Label className="text-xs text-[#64748B]">Aylık Gelir</Label>
             <div className="relative">
               <Input value={formatCurrency(analysisRes?.details?.total_income || 0)} readOnly className="h-8 text-sm bg-[#F8FAFC] border-dashed pr-24" />
               <Badge variant="outline" className="absolute right-1 top-1 text-[9px] bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]">Bütçeden alındı</Badge>
             </div>
           </div>
           <div className="space-y-1">
             <Label className="text-xs text-[#64748B]">Mevcut Borç Ödemesi</Label>
             <div className="relative">
               <Input value={formatCurrency(analysisRes?.details?.loan_payments || 0)} readOnly className="h-8 text-sm bg-[#F8FAFC] border-dashed pr-24" />
               <Badge variant="outline" className="absolute right-1 top-1 text-[9px] bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]">Bütçeden alındı</Badge>
             </div>
           </div>
        </div>
      </div>

      {/* 1. Üst Panel - Sliderlar */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <Label>Kredi Tutarı</Label>
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] text-sm">₺</span>
              <Input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(Number(e.target.value))}
                className="pl-7 h-9 text-right"
              />
            </div>
          </div>
          <Slider value={amount} min={10000} max={1000000} step={5000} onChange={setAmount} />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <Label>Vade</Label>
            <div className="relative w-24">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] text-sm">Ay</span>
              <Input 
                type="number" 
                value={months} 
                onChange={(e) => setMonths(Number(e.target.value))}
                className="pr-8 h-9 text-right"
              />
            </div>
          </div>
          <Slider value={months} min={6} max={120} step={6} onChange={setMonths} />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <Label>Yıllık Faiz Oranı</Label>
            <div className="relative w-24">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] text-sm">%</span>
              <Input 
                type="number" 
                value={interestRate} 
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="pl-7 h-9 text-right"
                step="0.5"
              />
            </div>
          </div>
          <Slider value={interestRate} min={1} max={60} step={0.5} onChange={setInterestRate} />
        </div>

      </div>

      {/* 2. Alt Panel - Sonuçlar */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sol - Hesaplama Sonuçları */}
          <div className="bg-[#F8FAFC] p-6 rounded-xl border border-[#E2E8F0] space-y-6">
            <h3 className="text-base font-semibold text-[#0F172A] border-b border-[#E2E8F0] pb-2">Hesaplama Sonuçları</h3>
            
            <div className="flex flex-col gap-1">
              <span className="text-sm text-[#64748B] font-medium uppercase tracking-wider">Aylık Taksit</span>
              <span className="text-4xl font-extrabold text-[#0A2540] tabular-nums tracking-tight">
                {formatCurrency(result.monthly_payment)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                <span className="block text-xs text-[#64748B] mb-1">Toplam Ödeme</span>
                <span className="text-lg font-bold text-[#0F172A] tabular-nums">{formatCurrency(result.total_payment)}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                <span className="block text-xs text-[#64748B] mb-1">Toplam Faiz</span>
                <span className="text-lg font-bold text-[#DC2626] tabular-nums">{formatCurrency(result.total_interest)}</span>
              </div>
            </div>
          </div>

          {/* Sağ - DTI Etkisi */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6 flex flex-col justify-center">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-base font-semibold text-[#0F172A]">Borç/Gelir (DTI) Etkisi</h3>
              {result.is_dti_safe ? (
                <Badge variant="success" className="bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Güvenli Bölge
                </Badge>
              ) : (
                <Badge variant="danger" className="bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" /> Riskli Bölge
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center">
                <span className="text-sm text-[#64748B] mb-1">Mevcut DTI</span>
                <div className="w-20 h-20 rounded-full border-4 border-[#E2E8F0] flex items-center justify-center">
                  <span className="text-xl font-bold text-[#0F172A] tabular-nums">{formatPercent(result.old_dti / 100)}</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <ArrowRight className={`w-6 h-6 ${result.old_dti < result.new_dti ? 'text-[#DC2626]' : 'text-[#059669]'}`} />
                <span className="text-xs font-medium text-[#64748B] bg-gray-100 px-2 py-0.5 rounded">
                  +{formatPercent((result.new_dti - result.old_dti) / 100)}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-sm text-[#64748B] mb-1">Yeni DTI</span>
                <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${result.is_dti_safe ? 'border-[#059669]' : 'border-[#DC2626]'}`}>
                  <span className={`text-xl font-bold tabular-nums ${result.is_dti_safe ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    {formatPercent(result.new_dti / 100)}
                  </span>
                </div>
              </div>
            </div>

            {!result.is_dti_safe && (
              <p className="text-sm text-[#991B1B] bg-[#FEF2F2] p-3 rounded-md text-center">
                Bu kredi taksiti bütçenizi zorlayabilir. Borç yükünüz gelirinizin %40'ını aşıyor.
              </p>
            )}
          </div>

        </div>
      )}

    </div>
    </BudgetGuard>
  )
}
