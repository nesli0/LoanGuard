import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, ChevronLeft, RefreshCw, Briefcase, Info } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts'

import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse } from '@/types'

const QUESTIONS = [
  {
    id: 'q1_risk_tolerance',
    text: 'Yatırımınızın değer kaybetmesine ne kadar toleransınız var?',
    options: [
      { value: 1, label: 'Hiç' },
      { value: 2, label: 'Az' },
      { value: 3, label: 'Orta' },
      { value: 4, label: 'Fazla' },
      { value: 5, label: 'Çok Fazla' },
    ]
  },
  {
    id: 'q2_investment_horizon',
    text: 'Paranızı ne kadar süre yatırımda tutmayı planlıyorsunuz?',
    options: [
      { value: 1, label: '6 aydan az' },
      { value: 2, label: '6 ay - 1 yıl' },
      { value: 3, label: '1 - 3 yıl' },
      { value: 4, label: '3 - 5 yıl' },
      { value: 5, label: '5 yıldan fazla' },
    ]
  },
  {
    id: 'q3_loss_reaction',
    text: 'Portföyünüz %20 düşse ne yaparsınız?',
    options: [
      { value: 1, label: 'Hepsini satarım' },
      { value: 2, label: 'Bir kısmını satarım' },
      { value: 3, label: 'Beklerim' },
      { value: 4, label: 'Daha fazla alırım' },
      { value: 5, label: 'Çok daha fazla alırım' },
    ]
  },
  {
    id: 'q4_income_stability',
    text: 'Geliriniz ne kadar düzenli?',
    options: [
      { value: 1, label: 'Çok düzensiz' },
      { value: 2, label: 'Düzensiz' },
      { value: 3, label: 'Orta' },
      { value: 4, label: 'Düzenli' },
      { value: 5, label: 'Çok düzenli' },
    ]
  },
  {
    id: 'q5_experience',
    text: 'Yatırım deneyiminiz nedir?',
    options: [
      { value: 1, label: 'Hiç yok' },
      { value: 2, label: 'Az' },
      { value: 3, label: 'Orta' },
      { value: 4, label: 'İyi' },
      { value: 5, label: 'Çok iyi' },
    ]
  }
]

export function InvestmentPage() {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [isRetaking, setIsRetaking] = useState(false)

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ['investment-profile'],
    queryFn: async () => {
      try {
        const res = await api.get<ApiResponse<any>>('/investment/profile')
        return res.data.data
      } catch (err: any) {
        if (err.response?.status === 404) return null
        throw err
      }
    },
    retry: false
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (profileRes) {
        await api.put('/investment/profile', payload)
      } else {
        await api.post('/investment/profile', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investment-profile'] })
      setIsRetaking(false)
    }
  })

  if (isLoading) return <LoadingSkeleton type="table" rows={4} />

  const hasProfile = profileRes && profileRes.risk_level && !isRetaking

  const handleOptionSelect = (qId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const handleNext = () => {
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      // Submit
      const payload = {
        answers: Object.entries(answers).map(([question_id, answer_value]) => ({
          question_id,
          answer_value
        }))
      }
      saveMutation.mutate(payload)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  // Questionnaire Flow
  if (!hasProfile) {
    const question = QUESTIONS[currentStep]
    const selectedValue = answers[question.id]
    const isLast = currentStep === QUESTIONS.length - 1

    return (
      <div className="max-w-3xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm min-h-[500px] flex flex-col">
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#0F172A] mb-2">Yatırım Profili Anketi</h1>
            <p className="text-sm text-[#64748B]">Size en uygun yatırım portföyünü oluşturmamız için aşağıdaki soruları yanıtlayın.</p>
            <div className="flex gap-2 mt-6">
              {QUESTIONS.map((q, i) => (
                <div key={q.id} className={`h-1.5 flex-1 rounded-full ${i <= currentStep ? 'bg-[#2D9CDB]' : 'bg-[#E2E8F0]'}`} />
              ))}
            </div>
            <div className="text-right text-xs text-[#64748B] mt-2 font-medium">Adım {currentStep + 1} / {QUESTIONS.length}</div>
          </div>

          <div className="flex-1 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-6">{question.text}</h2>
            <div className="grid grid-cols-1 gap-3">
              {question.options.map(opt => {
                const isSelected = selectedValue === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleOptionSelect(question.id, opt.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group
                      ${isSelected ? 'border-[#0A2540] bg-[#F8FAFC]' : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'}`}
                  >
                    <span className={`font-medium ${isSelected ? 'text-[#0A2540]' : 'text-[#0F172A]'}`}>{opt.label}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${isSelected ? 'border-[#0A2540] bg-[#0A2540]' : 'border-[#CBD5E1]'}`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-between pt-8 mt-8 border-t border-gray-100">
            <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Geri
            </Button>
            <Button 
              onClick={handleNext} 
              className="bg-[#0A2540] hover:bg-[#1B4F8A]"
              disabled={!selectedValue || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Kaydediliyor...' : isLast ? 'Tamamla' : <>İleri <ChevronRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Profile Result Flow
  const getRiskLabel = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'conservative': return 'Muhafazakâr'
      case 'moderate': return 'Dengeli'
      case 'aggressive': return 'Agresif'
      default: return 'Belirsiz'
    }
  }

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'conservative': return 'success'
      case 'moderate': return 'warning'
      case 'aggressive': return 'danger'
      default: return 'default'
    }
  }

  // Mock pie chart data based on risk level since backend doesn't explicitly return percentages
  const getMockPieData = (level: string) => {
    if (level === 'aggressive') {
      return [{ name: 'Hisse Senedi', value: 70, fill: '#DC2626' }, { name: 'Kripto/Alternatif', value: 20, fill: '#D97706' }, { name: 'Tahvil', value: 10, fill: '#059669' }]
    }
    if (level === 'moderate') {
      return [{ name: 'Hisse Senedi', value: 40, fill: '#2D9CDB' }, { name: 'Tahvil/Fon', value: 40, fill: '#0A2540' }, { name: 'Altın', value: 20, fill: '#D97706' }]
    }
    return [{ name: 'Mevduat', value: 50, fill: '#059669' }, { name: 'Tahvil', value: 30, fill: '#2D9CDB' }, { name: 'Altın', value: 20, fill: '#D97706' }]
  }

  const pieData = getMockPieData(profileRes.risk_level)
  const instruments = profileRes.recommended_instruments || []

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Yatırım Profiliniz</h1>
          <p className="text-sm text-[#64748B]">Risk toleransınıza göre size özel yatırım önerileri.</p>
        </div>
        <Button variant="outline" onClick={() => { setAnswers({}); setCurrentStep(0); setIsRetaking(true); }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Profili Güncelle
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sol / Orta Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-2">Risk Profiliniz</h3>
            <div className="flex items-center gap-4">
              <Badge variant={getRiskColor(profileRes.risk_level)} className="text-lg px-4 py-1">
                {getRiskLabel(profileRes.risk_level)}
              </Badge>
              <div className="text-sm text-[#0F172A] flex items-center bg-[#F1F5F9] px-3 py-1.5 rounded-md">
                <Info className="w-4 h-4 mr-2 text-[#2D9CDB]" /> Skor: <b>{profileRes.risk_score}</b> / 25
              </div>
            </div>
            <p className="text-sm text-[#64748B] mt-4 leading-relaxed">
              Yatırım anketimize verdiğiniz yanıtlara göre risk seviyeniz belirlenmiştir. Aşağıda bu profile en uygun olan yatırım araçları tavsiye edilmektedir.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Önerilen Yatırım Araçları</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {instruments.length > 0 ? instruments.map((inst: string, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="w-10 h-10 rounded-md bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-[#2D9CDB]" />
                  </div>
                  <span className="font-medium text-[#0F172A]">{inst}</span>
                </div>
              )) : (
                <div className="text-sm text-[#64748B]">Veri bulunamadı.</div>
              )}
            </div>
          </div>
        </div>

        {/* Sağ Panel - Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-[400px]">
          <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Örnek Portföy Dağılımı</h3>
          <p className="text-xs text-[#64748B] mb-6">Profilinize uygun örnek varlık dağılımı grafiği.</p>
          
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: any) => `%${value}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  )
}
