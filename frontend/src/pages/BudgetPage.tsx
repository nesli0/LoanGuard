import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'
import api from '@/api/axios'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse, BudgetEntry, BudgetEntryCreate, BudgetEntryUpdate, BudgetPeriod } from '@/types'

type EntryType = 'income' | 'expense'

// ── Inline Form ──────────────────────────────────────────────────────────────
interface InlineFormProps {
  type: EntryType
  initialData?: Partial<BudgetEntryCreate>
  onSave: (entry: BudgetEntryCreate) => void
  onCancel: () => void
  isSaving?: boolean
}

function InlineForm({ type, initialData, onSave, onCancel, isSaving }: InlineFormProps) {
  const [category, setCategory] = useState(initialData?.category ?? '')
  const [amount, setAmount] = useState<string>(initialData?.amount?.toString() ?? '')
  const [isFixed, setIsFixed] = useState(initialData?.is_fixed ?? false)
  const [isLoan, setIsLoan] = useState(initialData?.is_loan_payment ?? false)

  const handleSave = () => {
    if (!category.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return
    onSave({
      type,
      category: category.trim(),
      amount: Number(amount),
      is_fixed: isFixed,
      is_loan_payment: type === 'expense' ? isLoan : false,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-3 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex gap-3">
        <Input
          placeholder="Kategori adı (örn: Maaş, Kira)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-white"
          autoFocus
        />
        <Input
          type="number"
          placeholder="Tutar"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-32 bg-white"
          min="0.01"
          step="0.01"
        />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer text-[#0F172A]">
          <input
            type="checkbox"
            checked={isFixed}
            onChange={(e) => setIsFixed(e.target.checked)}
            className="rounded border-[#E2E8F0] text-[#2D9CDB] focus:ring-[#2D9CDB]"
          />
          Sabit Kalem
        </label>
        {type === 'expense' && (
          <label className="flex items-center gap-2 cursor-pointer text-[#0F172A]">
            <input
              type="checkbox"
              checked={isLoan}
              onChange={(e) => setIsLoan(e.target.checked)}
              className="rounded border-[#E2E8F0] text-[#2D9CDB] focus:ring-[#2D9CDB]"
            />
            Kredi Taksiti
          </label>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          İptal
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#2D9CDB] hover:bg-[#1B84C3] text-white min-w-[80px]"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet'}
        </Button>
      </div>
    </div>
  )
}

// ── BudgetPage ───────────────────────────────────────────────────────────────
export function BudgetPage() {
  const queryClient = useQueryClient()
  const today = new Date()

  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [addingType, setAddingType] = useState<EntryType | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  // ── 1. İlk yüklemede en son bütçe dönemini al — ay/yıl state'ini init et
  const { data: latestRes } = useQuery({
    queryKey: ['budget-latest'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BudgetPeriod>>('/budget/latest')
      return res.data.data
    },
  })

  const initialized = useRef(false)

  useEffect(() => {
    if (latestRes && !initialized.current) {
      setCurrentMonth(latestRes.month)
      setCurrentYear(latestRes.year)
      initialized.current = true
    }
  }, [latestRes])

  // ── 2. Seçilen ay/yıla göre veri çek (queryKey değişince otomatik re-fetch)
  const { data: periodRes, isLoading: isPeriodLoading } = useQuery({
    queryKey: ['budget-period', currentYear, currentMonth],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BudgetPeriod>>(`/budget/${currentYear}/${currentMonth}`)
      return res.data.data  // null → bu ay için bütçe yok
    },
  })

  const entries: BudgetEntry[] = periodRes?.entries ?? []

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['budget-period', currentYear, currentMonth] })
    queryClient.invalidateQueries({ queryKey: ['budget-latest'] })
    queryClient.invalidateQueries({ queryKey: ['budget-analysis'] })
  }

  // ── 3. Yeni entry ekle — POST /budget (tam liste gönderilir, period oluşturulur)
  const addMutation = useMutation({
    mutationFn: async (newEntry: BudgetEntryCreate) => {
      const payload = {
        month: currentMonth,
        year: currentYear,
        entries: [
          ...entries.map((e) => ({
            type: e.type as EntryType,
            category: e.category,
            amount: e.amount,
            is_fixed: e.is_fixed,
            is_loan_payment: e.is_loan_payment,
            note: e.note ?? undefined,
          })),
          newEntry,
        ],
      }
      const res = await api.post<ApiResponse<BudgetPeriod>>('/budget', payload)
      return res.data.data
    },
    onSuccess: () => {
      invalidateQueries()
      setAddingType(null)
    },
  })

  // ── 4. Entry güncelle — PATCH /budget/entries/{id}
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BudgetEntryUpdate }) => {
      const res = await api.patch<ApiResponse<BudgetEntry>>(`/budget/entries/${id}`, data)
      return res.data.data
    },
    onSuccess: () => {
      invalidateQueries()
      setEditingEntryId(null)
    },
  })

  // ── 5. Entry sil — DELETE /budget/entries/{id}
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/budget/entries/${id}`)
    },
    onSuccess: () => {
      invalidateQueries()
    },
  })

  const handlePrevMonth = () => {
    let m = currentMonth - 1
    let y = currentYear
    if (m < 1) { m = 12; y -= 1 }
    setCurrentMonth(m)
    setCurrentYear(y)
    setAddingType(null)
    setEditingEntryId(null)
  }

  const handleNextMonth = () => {
    let m = currentMonth + 1
    let y = currentYear
    if (m > 12) { m = 1; y += 1 }
    setCurrentMonth(m)
    setCurrentYear(y)
    setAddingType(null)
    setEditingEntryId(null)
  }

  // İlk yüklemede (latest henüz gelmemişken) full skeleton göster
  if (!latestRes && isPeriodLoading) {
    return <LoadingSkeleton type="table" rows={6} />
  }

  const incomes = entries.filter((e) => e.type === 'income')
  const expenses = entries.filter((e) => e.type === 'expense')
  const totalIncome = incomes.reduce((sum, e) => sum + e.amount, 0)
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netDiff = totalIncome - totalExpense

  // Fallback banner: seçilen ayda veri yok ama başka ay verisi var
  const showFallbackBanner = !isPeriodLoading && periodRes === null && latestRes != null

  // ── Entry satırı render
  const renderEntry = (item: BudgetEntry) => {
    const isEditing = editingEntryId === item.id
    const isDeleting = deleteMutation.isPending

    if (isEditing) {
      return (
        <InlineForm
          key={item.id}
          type={item.type as EntryType}
          initialData={{ ...item, note: item.note ?? undefined }}
          isSaving={editMutation.isPending}
          onSave={(data) =>
            editMutation.mutate({
              id: item.id,
              data: {
                category: data.category,
                amount: data.amount,
                is_fixed: data.is_fixed,
                is_loan_payment: data.is_loan_payment,
                note: data.note,
              },
            })
          }
          onCancel={() => setEditingEntryId(null)}
        />
      )
    }

    return (
      <div
        key={item.id}
        className="flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow group"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-[#0F172A]">{item.category}</span>
          <div className="flex items-center gap-2">
            <Badge variant={item.is_fixed ? 'outline' : 'accent'} className="text-[10px] px-1.5 py-0">
              {item.is_fixed ? 'Sabit' : 'Değişken'}
            </Badge>
            {item.is_loan_payment && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                Kredi Taksiti
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-base font-bold tabular-nums text-[#0F172A]">
            {formatCurrency(item.amount)}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditingEntryId(item.id)}
              className="p-1.5 text-[#64748B] hover:text-[#2D9CDB] hover:bg-[#EFF8FF] rounded-md transition-colors"
              title="Düzenle"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteMutation.mutate(item.id)}
              disabled={isDeleting}
              className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors disabled:opacity-40"
              title="Sil"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Bütçe Yönetimi</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-md hover:bg-gray-100 text-[#64748B] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold w-36 text-center text-[#0F172A]">
            {getMonthName(currentMonth)} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-md hover:bg-gray-100 text-[#64748B] transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Fallback Banner */}
      {showFallbackBanner && latestRes && (
        <div className="flex items-start gap-3 p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-[#92400E]">Bu ay için bütçe girilmemiş. </span>
            <span className="text-[#92400E]">
              Kredi analizi ve simülatör hesaplamaları{' '}
              <strong>{getMonthName(latestRes.month)} {latestRes.year}</strong> bütçesiyle
              yapılıyor. Yeni kalem ekleyerek bu ay için bütçe oluşturabilirsiniz.
            </span>
          </div>
        </div>
      )}

      {/* Loading overlay — ay geçişlerinde */}
      {isPeriodLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Gelir Kolonu */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h2 className="text-base font-semibold text-[#0F172A]">Gelirler</h2>
              <Badge variant="success" className="text-xs">{formatCurrency(totalIncome)}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {incomes.map((item) => renderEntry(item))}
              {addingType === 'income' ? (
                <InlineForm
                  type="income"
                  isSaving={addMutation.isPending}
                  onSave={(entry) => addMutation.mutate(entry)}
                  onCancel={() => setAddingType(null)}
                />
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed border-2 text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50 h-12"
                  onClick={() => { setAddingType('income'); setEditingEntryId(null) }}
                  disabled={addMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" /> Gelir Ekle
                </Button>
              )}
            </div>
          </div>

          {/* Gider Kolonu */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h2 className="text-base font-semibold text-[#0F172A]">Giderler</h2>
              <Badge variant="danger" className="text-xs">{formatCurrency(totalExpense)}</Badge>
            </div>
            <div className="flex flex-col gap-3">
              {expenses.map((item) => renderEntry(item))}
              {addingType === 'expense' ? (
                <InlineForm
                  type="expense"
                  isSaving={addMutation.isPending}
                  onSave={(entry) => addMutation.mutate(entry)}
                  onCancel={() => setAddingType(null)}
                />
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed border-2 text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50 h-12"
                  onClick={() => { setAddingType('expense'); setEditingEntryId(null) }}
                  disabled={addMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" /> Gider Ekle
                </Button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Footer Özet */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(50%+120px)] w-[90%] max-w-2xl bg-white border border-gray-200 shadow-xl rounded-xl p-4 flex items-center justify-between divide-x divide-gray-100 z-40">
        <div className="flex-1 px-4 text-center">
          <div className="text-xs text-[#64748B] uppercase font-semibold tracking-wider mb-1">Toplam Gelir</div>
          <div className="text-lg font-bold text-[#059669] tabular-nums">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="flex-1 px-4 text-center">
          <div className="text-xs text-[#64748B] uppercase font-semibold tracking-wider mb-1">Toplam Gider</div>
          <div className="text-lg font-bold text-[#DC2626] tabular-nums">{formatCurrency(totalExpense)}</div>
        </div>
        <div className="flex-1 px-4 text-center">
          <div className="text-xs text-[#64748B] uppercase font-semibold tracking-wider mb-1">Net Fark</div>
          <div className={`text-xl font-extrabold tabular-nums ${netDiff >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
            {netDiff > 0 ? '+' : ''}{formatCurrency(netDiff)}
          </div>
        </div>
      </div>

    </div>
  )
}
