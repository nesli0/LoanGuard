import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Target, MoreVertical, Edit2, Trash2, Calendar, Loader2 } from 'lucide-react'

import api from '@/api/axios'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse } from '@/types'

const goalSchema = z.object({
  title: z.string().min(1, 'Hedef adı zorunludur'),
  category: z.string().min(1, 'Kategori seçiniz'),
  target_amount: z.coerce.number().min(1, 'Hedef tutar zorunludur'),
  current_amount: z.coerce.number().min(0, 'Mevcut tutar 0 veya daha büyük olmalıdır'),
  monthly_target: z.coerce.number().min(1, 'Aylık tasarruf hedefi zorunludur'),
  deadline: z.string().min(1, 'Hedef tarihi seçiniz'),
})

type GoalFormData = z.infer<typeof goalSchema>

interface Goal {
  id: string
  title: string
  category: string
  target_amount: number
  current_amount: number
  monthly_target: number
  deadline: string
  is_completed: boolean
}

export function GoalsPage() {
  const queryClient = useQueryClient()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const { data: goalsRes, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Goal[]>>('/goals')
      return res.data.data
    },
  })

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema) as any,
    defaultValues: { current_amount: 0 }
  })

  const saveMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, data)
      } else {
        await api.post('/goals', data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setIsSheetOpen(false)
      setEditingGoal(null)
      reset()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/goals/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setOpenMenuId(null)
    }
  })

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal)
    reset({
      title: goal.title,
      category: goal.category,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      monthly_target: goal.monthly_target,
      // Date input expects YYYY-MM-DD
      deadline: new Date(goal.deadline).toISOString().split('T')[0]
    })
    setOpenMenuId(null)
    setIsSheetOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Bu hedefi silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleOpenNew = () => {
    setEditingGoal(null)
    reset({ current_amount: 0, title: '', category: '', target_amount: 0, monthly_target: 0, deadline: '' })
    setIsSheetOpen(true)
  }

  if (isLoading) return <LoadingSkeleton type="cards" cards={6} />

  const goals = goalsRes || []

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300" onClick={() => setOpenMenuId(null)}>
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Finansal Hedeflerim</h1>
          <p className="text-sm text-[#64748B]">Hayallerinize ulaşmak için ilerlemenizi takip edin.</p>
        </div>
        <Button onClick={handleOpenNew} className="bg-[#0A2540] hover:bg-[#1B4F8A]">
          <Target className="w-4 h-4 mr-2" /> Yeni Hedef
        </Button>
      </div>

      {/* Sheet Form */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-white border-l-[#E2E8F0]">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingGoal ? 'Hedefi Düzenle' : 'Yeni Hedef Oluştur'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-5">
            
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acil_fon">Acil Durum Fonu</SelectItem>
                      <SelectItem value="ev">Ev / Peşinat</SelectItem>
                      <SelectItem value="araba">Araba</SelectItem>
                      <SelectItem value="tatil">Tatil</SelectItem>
                      <SelectItem value="emeklilik">Emeklilik</SelectItem>
                      <SelectItem value="eğitim">Eğitim</SelectItem>
                      <SelectItem value="diğer">Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <span className="text-xs text-[#DC2626]">{errors.category.message}</span>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Hedef Adı</Label>
              <Input id="title" {...register('title')} placeholder="Örn: Yeni araba peşinatı" />
              {errors.title && <span className="text-xs text-[#DC2626]">{errors.title.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="target_amount">Hedef Tutar (₺)</Label>
                <Input id="target_amount" type="number" {...register('target_amount')} />
                {errors.target_amount && <span className="text-xs text-[#DC2626]">{errors.target_amount.message}</span>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="current_amount">Mevcut Birikim (₺)</Label>
                <Input id="current_amount" type="number" {...register('current_amount')} />
                {errors.current_amount && <span className="text-xs text-[#DC2626]">{errors.current_amount.message}</span>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monthly_target">Aylık Tasarruf Hedefi (₺)</Label>
              <Input id="monthly_target" type="number" {...register('monthly_target')} />
              <p className="text-[10px] text-[#64748B]">Bu hedefe her ay ne kadar ayırmayı planlıyorsunuz?</p>
              {errors.monthly_target && <span className="text-xs text-[#DC2626]">{errors.monthly_target.message}</span>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deadline">Hedef Tarihi</Label>
              <Input id="deadline" type="date" {...register('deadline')} />
              {errors.deadline && <span className="text-xs text-[#DC2626]">{errors.deadline.message}</span>}
            </div>

            <Button type="submit" className="w-full bg-[#2D9CDB] hover:bg-[#1B84C3] mt-4" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Kaydet'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Grid */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-[#CBD5E1]">
          <Target className="w-12 h-12 text-[#94A3B8] mb-4" />
          <h3 className="text-lg font-medium text-[#0F172A]">Henüz hedef eklenmemiş</h3>
          <p className="text-sm text-[#64748B] mb-6 mt-1">Finansal hedeflerinizi belirleyip ilerlemenizi takip edebilirsiniz.</p>
          <Button onClick={handleOpenNew} variant="outline" className="border-[#E2E8F0] hover:bg-[#F8FAFC]">
            <Target className="w-4 h-4 mr-2" /> İlk Hedefini Oluştur
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progressPct = Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100))
            const monthsLeft = goal.monthly_target > 0 
              ? Math.ceil((goal.target_amount - goal.current_amount) / goal.monthly_target)
              : 0

            return (
              <div 
                key={goal.id} 
                className={`relative p-5 rounded-xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md h-[240px]
                  ${goal.is_completed ? 'bg-[#ECFDF5] border-[#A7F3D0]' : 'bg-white border-[#E2E8F0]'}`}
              >
                {/* 3 Nokta Menü */}
                <div className="absolute top-4 right-3 z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === goal.id ? null : goal.id); }}
                    className="p-1.5 text-[#64748B] hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {openMenuId === goal.id && (
                    <div className="absolute right-0 mt-1 w-32 bg-white border border-[#E2E8F0] shadow-lg rounded-md overflow-hidden z-20">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(goal); }} className="w-full flex items-center px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">
                        <Edit2 className="w-3.5 h-3.5 mr-2 text-[#64748B]" /> Düzenle
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }} className="w-full flex items-center px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FEF2F2]">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Sil
                      </button>
                    </div>
                  )}
                </div>

                {/* İçerik */}
                <div>
                  <Badge variant={goal.is_completed ? "success" : "accent"} className="mb-3 px-2.5 py-0.5 text-[10px] uppercase tracking-wider">
                    {goal.category.replace('_', ' ')}
                  </Badge>
                  <h3 className="font-semibold text-lg text-[#0F172A] line-clamp-1 pr-6" title={goal.title}>{goal.title}</h3>
                  <div className="text-sm font-medium text-[#64748B] mt-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> 
                    {new Date(goal.deadline).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}
                  </div>
                </div>

                <div className="space-y-3 mt-auto pt-4">
                  <div className="flex justify-between items-end">
                    <span className="text-xl font-bold text-[#0F172A] tabular-nums">{formatCurrency(goal.current_amount)}</span>
                    <span className="text-sm text-[#64748B] font-medium">/ {formatCurrency(goal.target_amount)}</span>
                  </div>
                  
                  <div className="relative">
                    <Progress value={progressPct} className={`h-2.5 ${goal.is_completed ? '[&>div]:bg-[#059669]' : '[&>div]:bg-[#0A2540]'}`} />
                  </div>

                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className={goal.is_completed ? 'text-[#059669]' : 'text-[#2D9CDB]'}>
                      {formatPercent(progressPct / 100)} Tamamlandı
                    </span>
                    {!goal.is_completed && monthsLeft > 0 && (
                      <span className="text-[#64748B]">Hedefe ~{monthsLeft} ay kaldı</span>
                    )}
                    {goal.is_completed && (
                      <span className="text-[#059669] font-bold">Tamamlandı ✓</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
