import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, ArrowRight, ShieldCheck, Info, Sparkles } from 'lucide-react'
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell
} from 'recharts'

import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BudgetGuard } from '@/components/shared/BudgetGuard'
import type { ApiResponse } from '@/types'

const schema = z.object({
  income_override: z.coerce.number().optional(),
  loan_amount: z.coerce.number().min(1000, 'Minimum ₺1.000'),
  loan_term: z.coerce.number().min(6, 'Minimum 6 ay').max(120),
  interest_rate: z.coerce.number().min(0.001, "0'dan büyük olmalı").max(1, '0 ile 1 arasında olmalıdır'),
  credit_score: z.coerce.number().min(300).max(850, '300 ile 850 arasında olmalıdır'),
  num_credit_lines: z.coerce.number().min(0, '0 veya daha büyük olmalıdır'),
  has_mortgage: z.boolean(),
  has_co_signer: z.boolean(),
  months_employed: z.coerce.number().min(0, '0 veya daha büyük olmalıdır'),
  loan_purpose: z.string().min(1, 'Kredi amacı seçiniz'),
})

type FormData = z.infer<typeof schema>

export function CreditPage() {
  const [result, setResult] = useState<any | null>(null)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)

  const { data: budgetRes } = useQuery({
    queryKey: ['budget-latest'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any>>('/budget/latest')
      return res.data.data
    },
  })

  const totalIncome = budgetRes?.entries?.reduce((acc: number, curr: any) =>
    curr.type === 'income' ? acc + Number(curr.amount) : acc
  , 0) || 0

  const totalExpense = budgetRes?.entries?.reduce((acc: number, curr: any) =>
    curr.type === 'expense' ? acc + Number(curr.amount) : acc
  , 0) || 0

  // **bold** ve *italic* markdown işaretlerini JSX'e çevirir
  const renderMarkdown = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
      if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
      return <span key={i}>{part}</span>
    })
  }

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      income_override: 0,
      loan_amount: 50000,
      loan_term: 24,
      interest_rate: 0.32,
      credit_score: 650,
      num_credit_lines: 2,
      has_mortgage: false,
      has_co_signer: false,
      months_employed: 24,
      loan_purpose: '',
    }
  })

  useEffect(() => {
    if (totalIncome > 0) {
      setValue('income_override', totalIncome)
    }
  }, [totalIncome, setValue])

  const { mutate: explainMutate, isPending: isExplaining } = useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await api.post<ApiResponse<{ explanation: string }>>('/credit/explain', { analysis_id: analysisId })
      return res.data.data.explanation
    },
    onSuccess: (explanation) => {
      setAiExplanation(explanation)
    },
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post<ApiResponse<any>>('/credit/analyze', data)
      return res.data.data
    },
    onSuccess: (data) => {
      setResult(data)
      setAiExplanation(null)
      if (data.analysis_id && data.counterfactuals?.length > 0) {
        explainMutate(data.analysis_id)
      }
    }
  })

  const getScoreColor = (prob: number) => {
    const val = prob * 100
    if (val >= 70) return '#059669' // green
    if (val >= 50) return '#D97706' // amber
    return '#DC2626' // red
  }

  return (
    <BudgetGuard message="Kredi analizi yapabilmek için önce bütçe bilgilerinizi girmeniz gerekiyor.">
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Kredi Analizi</h1>
          <p className="text-sm text-[#64748B]">Yapay zeka ile kredi onay ihtimalinizi ve risk faktörlerini hesaplayın.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Sol Panel - Form */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Aylık Gelir (Bütçeden) */}
              <div className="space-y-1.5">
                <Label htmlFor="income_override">Aylık Gelir (₺)</Label>
                <div className="relative">
                  <Input id="income_override" type="number" {...register('income_override')} />
                  <Badge variant="outline" className="absolute right-2 top-2 text-[10px] bg-[#F8FAFC] text-[#64748B]">Bütçeden</Badge>
                </div>
                <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                  Bankacılık standardı: brüt gelir kullanılır, giderler DTI oranına yansır.
                  {totalExpense > 0 && (
                    <span className="ml-1 text-[#64748B] font-medium">
                      Net: ₺{(totalIncome - totalExpense).toLocaleString('tr-TR')}
                    </span>
                  )}
                </p>
                {errors.income_override && <span className="text-xs text-[#DC2626]">{errors.income_override.message}</span>}
              </div>

              {/* Kredi Tutarı */}
              <div className="space-y-1.5">
                <Label htmlFor="loan_amount">Kredi Tutarı (₺)</Label>
                <Input id="loan_amount" type="number" {...register('loan_amount')} />
                {errors.loan_amount && <span className="text-xs text-[#DC2626]">{errors.loan_amount.message}</span>}
              </div>

              {/* Vade */}
              <div className="space-y-1.5">
                <Label>Vade (Ay)</Label>
                <Controller
                  name="loan_term"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 Ay</SelectItem>
                        <SelectItem value="24">24 Ay</SelectItem>
                        <SelectItem value="36">36 Ay</SelectItem>
                        <SelectItem value="48">48 Ay</SelectItem>
                        <SelectItem value="60">60 Ay</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.loan_term && <span className="text-xs text-[#DC2626]">{errors.loan_term.message}</span>}
              </div>

              {/* Faiz Oranı */}
              <div className="space-y-1.5">
                <Label htmlFor="interest_rate">Faiz Oranı (0.0 - 1.0)</Label>
                <Input id="interest_rate" type="number" step="0.01" {...register('interest_rate')} />
                <p className="text-[10px] text-[#64748B]">Örn: %32 için 0.32 giriniz.</p>
                {errors.interest_rate && <span className="text-xs text-[#DC2626]">{errors.interest_rate.message}</span>}
              </div>

              {/* Kredi Skoru */}
              <div className="space-y-1.5">
                <Label htmlFor="credit_score">Kredi Skoru (300-850)</Label>
                <Input id="credit_score" type="number" {...register('credit_score')} />
                {errors.credit_score && <span className="text-xs text-[#DC2626]">{errors.credit_score.message}</span>}
              </div>

              {/* Aktif Kredi Sayısı */}
              <div className="space-y-1.5">
                <Label htmlFor="num_credit_lines">Aktif Kredi Sayısı</Label>
                <Input id="num_credit_lines" type="number" {...register('num_credit_lines')} />
                {errors.num_credit_lines && <span className="text-xs text-[#DC2626]">{errors.num_credit_lines.message}</span>}
              </div>

              {/* Çalışma Süresi */}
              <div className="space-y-1.5">
                <Label htmlFor="months_employed">Çalışma Süresi (Ay)</Label>
                <Input id="months_employed" type="number" {...register('months_employed')} />
                {errors.months_employed && <span className="text-xs text-[#DC2626]">{errors.months_employed.message}</span>}
              </div>

              {/* Kredi Amacı */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Kredi Amacı</Label>
                <Controller
                  name="loan_purpose"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ev">Ev / Konut</SelectItem>
                        <SelectItem value="araç">Araç / Taşıt</SelectItem>
                        <SelectItem value="eğitim">Eğitim</SelectItem>
                        <SelectItem value="iş">İş / Ticari</SelectItem>
                        <SelectItem value="diğer">Diğer</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.loan_purpose && <span className="text-xs text-[#DC2626]">{errors.loan_purpose.message}</span>}
              </div>

              {/* Toggles */}
              <div className="space-y-3 sm:col-span-2 bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0]">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#0F172A]">
                  <input type="checkbox" {...register('has_mortgage')} className="rounded border-[#E2E8F0] text-[#2D9CDB] focus:ring-[#2D9CDB]" />
                  İpotekli mülkünüz var mı? (Mortgage)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#0F172A]">
                  <input type="checkbox" {...register('has_co_signer')} className="rounded border-[#E2E8F0] text-[#2D9CDB] focus:ring-[#2D9CDB]" />
                  Kefiliniz var mı?
                </label>
              </div>

            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>Analiz işlemi başarısız oldu. Lütfen değerleri kontrol edin.</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full bg-[#0A2540] hover:bg-[#1B4F8A] h-12 text-base" disabled={isPending}>
              {isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analiz Ediliyor...</> : 'Analiz Et'}
            </Button>

          </form>
        </div>

        {/* Sağ Panel - Sonuç */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-[600px]">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#64748B] space-y-4">
              <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-[#94A3B8]" />
              </div>
              <p className="font-medium text-center">Analiz yapmak için sol taraftaki<br/>formu doldurun ve "Analiz Et"e tıklayın.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              
              {/* 1. Onaylanma İhtimali */}
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-2">Onaylanma İhtimali</h3>
                <div className="relative w-full h-[200px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart 
                      cx="50%" 
                      cy="70%" 
                      innerRadius="70%" 
                      outerRadius="100%" 
                      barSize={20} 
                      data={[{ name: 'İhtimal', value: result.approval_probability * 100, fill: getScoreColor(result.approval_probability) }]} 
                      startAngle={180} 
                      endAngle={0}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar background={{ fill: '#F1F5F9' }} dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <span className="text-5xl font-extrabold text-[#0F172A] tabular-nums tracking-tight">
                      {(result.approval_probability * 100).toFixed(0)}<span className="text-2xl text-[#64748B]">%</span>
                    </span>
                  </div>
                </div>
                <Badge variant={result.approval_probability >= 0.5 ? "success" : "danger"} className="mt-2 text-sm px-3 py-1">
                  {result.approval_band}
                </Badge>
              </div>

              {/* 2. SHAP Faktörleri */}
              {result.shap_factors && result.shap_factors.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#2D9CDB]" /> Kararı Etkileyen Faktörler
                  </h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={result.shap_factors.map((f: any) => ({
                          name: f.feature_tr,
                          value: f.direction === '+' ? -f.shap_value : f.shap_value, // Negative meaning risk? Wait: '-' means decreased risk (positive impact), '+' means increased risk (negative impact)
                          displayValue: f.shap_value,
                          direction: f.direction
                        }))} 
                        layout="vertical"
                        margin={{ top: 0, right: 30, left: 30, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#0F172A', fontWeight: 500 }} width={120} />
                        <RechartsTooltip 
                          formatter={(_val: any, _name: any, props: any) => [
                            props.payload.direction === '+' ? 'Riski Artırdı' : 'Riski Azalttı', 
                            'Etki Yönü'
                          ]}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={4} barSize={20}>
                          {result.shap_factors.map((f: any, i: number) => (
                            <Cell key={`cell-${i}`} fill={f.direction === '-' ? '#059669' : '#DC2626'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 3. Öneriler (Counterfactuals) */}
              {result.counterfactuals && result.counterfactuals.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#7C3AED]" /> Onay Almak İçin Öneriler
                  </h3>

                  {isExplaining ? (
                    <div className="space-y-3 p-4 rounded-lg border border-[#E9D5FF] bg-[#FAF5FF]">
                      <div className="flex items-center gap-2 text-sm text-[#7C3AED] font-medium mb-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Yapay Zeka önerileri yorumluyor...
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/6" />
                    </div>
                  ) : aiExplanation ? (
                    <div className="p-5 rounded-lg border border-[#E9D5FF] bg-[#FAF5FF]">
                      <p className="text-sm leading-relaxed text-[#3B0764]">
                        {renderMarkdown(aiExplanation)}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {result.counterfactuals.map((cf: any, i: number) => (
                        <div key={i} className="p-4 rounded-lg border-2 border-[#A7F3D0] bg-[#ECFDF5] flex items-center justify-between group transition-all hover:shadow-md">
                          <div className="space-y-1">
                            {Object.entries(cf.changes).map(([key, val]: [string, any]) => (
                              <div key={key} className="text-sm font-medium text-[#065F46]">
                                {key} değerini <span className="font-bold">{val.from}</span> yerine <span className="font-bold text-[#059669]">{val.to}</span> yapın.
                              </div>
                            ))}
                          </div>
                          <Badge variant="success" className="shrink-0">
                            Onaylanır <ArrowRight className="w-3 h-3 ml-1" />
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
    </BudgetGuard>
  )
}
