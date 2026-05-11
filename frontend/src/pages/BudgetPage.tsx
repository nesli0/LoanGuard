import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/api/axios'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse, BudgetPeriod, BudgetEntryCreate } from '@/types'

type EntryType = 'income' | 'expense'

interface InlineFormProps {
  type: EntryType
  initialData?: BudgetEntryCreate
  onSave: (entry: BudgetEntryCreate) => void
  onCancel: () => void
}

function InlineForm({ type, initialData, onSave, onCancel }: InlineFormProps) {
  const [category, setCategory] = useState(initialData?.category || '')
  const [amount, setAmount] = useState<string>(initialData?.amount?.toString() || '')
  const [isFixed, setIsFixed] = useState(initialData?.is_fixed || false)
  const [isLoan, setIsLoan] = useState(initialData?.is_loan_payment || false)

  const handleSave = () => {
    if (!category || !amount || isNaN(Number(amount))) return
    onSave({
      type,
      category,
      amount: Number(amount),
      is_fixed: isFixed,
      is_loan_payment: type === 'expense' ? isLoan : false,
    })
  }

  return (
    <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-3 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex gap-3">
        <Input
          placeholder="Kategori adı (örn: Maaş, Kira)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 bg-white"
          autoFocus
        />
        <Input
          type="number"
          placeholder="Tutar"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 bg-white"
          min="0"
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
        <Button variant="ghost" size="sm" onClick={onCancel}>İptal</Button>
        <Button size="sm" onClick={handleSave} className="bg-[#2D9CDB] hover:bg-[#1B84C3] text-white">Kaydet</Button>
      </div>
    </div>
  )
}

export function BudgetPage() {
  const queryClient = useQueryClient()
  const today = new Date()
  
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [localEntries, setLocalEntries] = useState<BudgetEntryCreate[]>([])
  
  const [addingType, setAddingType] = useState<EntryType | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const { data: latestRes, isLoading } = useQuery({
    queryKey: ['budget-latest'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BudgetPeriod>>('/budget/latest')
      return res.data.data
    },
  })

  // Sadece ilk yüklemede veriyi local state'e al
  useEffect(() => {
    if (latestRes) {
      setCurrentMonth(latestRes.month)
      setCurrentYear(latestRes.year)
      setLocalEntries(
        latestRes.entries.map(e => ({
          type: e.type as EntryType,
          category: e.category,
          amount: e.amount,
          is_fixed: e.is_fixed,
          is_loan_payment: e.is_loan_payment,
          note: e.note || undefined,
        }))
      )
    }
  }, [latestRes])

  const saveMutation = useMutation({
    mutationFn: async (entries: BudgetEntryCreate[]) => {
      const res = await api.post<ApiResponse<BudgetPeriod>>('/budget', {
        month: currentMonth,
        year: currentYear,
        entries,
      })
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-latest'] })
      queryClient.invalidateQueries({ queryKey: ['budget-analysis'] })
    },
  })

  const updateEntries = (newEntries: BudgetEntryCreate[]) => {
    setLocalEntries(newEntries)
    saveMutation.mutate(newEntries)
  }

  const handleAdd = (entry: BudgetEntryCreate) => {
    updateEntries([...localEntries, entry])
    setAddingType(null)
  }

  const handleEdit = (entry: BudgetEntryCreate, index: number) => {
    const updated = [...localEntries]
    updated[index] = entry
    updateEntries(updated)
    setEditingIndex(null)
  }

  const handleDelete = (index: number) => {
    const updated = localEntries.filter((_, i) => i !== index)
    updateEntries(updated)
  }

  const handlePrevMonth = () => {
    let m = currentMonth - 1
    let y = currentYear
    if (m < 1) { m = 12; y -= 1 }
    setCurrentMonth(m)
    setCurrentYear(y)
    // Gerçekte API'da GET /budget/{y}/{m} olmadığı için local'i temizliyoruz.
    // Eğer o ay için veri eklerlerse POST yeni bütçe yaratacak.
    setLocalEntries([]) 
  }

  const handleNextMonth = () => {
    let m = currentMonth + 1
    let y = currentYear
    if (m > 12) { m = 1; y += 1 }
    setCurrentMonth(m)
    setCurrentYear(y)
    setLocalEntries([])
  }

  if (isLoading) return <LoadingSkeleton type="table" rows={6} />

  const incomes = localEntries.map((e, i) => ({ ...e, index: i })).filter(e => e.type === 'income')
  const expenses = localEntries.map((e, i) => ({ ...e, index: i })).filter(e => e.type === 'expense')

  const totalIncome = incomes.reduce((sum, e) => sum + e.amount, 0)
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netDiff = totalIncome - totalExpense

  const renderEntry = (item: BudgetEntryCreate & { index: number }) => (
    <div key={item.index} className="flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-[#0F172A]">{item.category}</span>
        <div className="flex items-center gap-2">
          <Badge variant={item.is_fixed ? "outline" : "accent"} className="text-[10px] px-1.5 py-0">
            {item.is_fixed ? 'Sabit' : 'Değişken'}
          </Badge>
          {item.is_loan_payment && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">Kredi Taksiti</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-base font-bold tabular-nums text-[#0F172A]">
          {formatCurrency(item.amount)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditingIndex(item.index)} className="p-1.5 text-[#64748B] hover:text-[#2D9CDB] hover:bg-[#EFF8FF] rounded-md transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(item.index)} className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Bütçe Yönetimi</h1>
        <div className="flex items-center gap-4">
          <button onClick={handlePrevMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-[#64748B] transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold w-32 text-center text-[#0F172A]">
            {getMonthName(currentMonth)} {currentYear}
          </span>
          <button onClick={handleNextMonth} className="p-1.5 rounded-md hover:bg-gray-100 text-[#64748B] transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Gelir Kolonu */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <h2 className="text-base font-semibold text-[#0F172A]">Gelirler</h2>
            <Badge variant="success" className="text-xs">{formatCurrency(totalIncome)}</Badge>
          </div>
          
          <div className="flex flex-col gap-3">
            {incomes.map(item => 
              editingIndex === item.index ? (
                <InlineForm key={item.index} type="income" initialData={item} onSave={(d) => handleEdit(d, item.index)} onCancel={() => setEditingIndex(null)} />
              ) : renderEntry(item)
            )}
            
            {addingType === 'income' ? (
              <InlineForm type="income" onSave={handleAdd} onCancel={() => setAddingType(null)} />
            ) : (
              <Button variant="outline" className="w-full border-dashed border-2 text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50 h-12" onClick={() => setAddingType('income')}>
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
            {expenses.map(item => 
              editingIndex === item.index ? (
                <InlineForm key={item.index} type="expense" initialData={item} onSave={(d) => handleEdit(d, item.index)} onCancel={() => setEditingIndex(null)} />
              ) : renderEntry(item)
            )}
            
            {addingType === 'expense' ? (
              <InlineForm type="expense" onSave={handleAdd} onCancel={() => setAddingType(null)} />
            ) : (
              <Button variant="outline" className="w-full border-dashed border-2 text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50 h-12" onClick={() => setAddingType('expense')}>
                <Plus className="w-4 h-4 mr-2" /> Gider Ekle
              </Button>
            )}
          </div>
        </div>

      </div>

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
