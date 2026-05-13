import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'

import api from '@/api/axios'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { ApiResponse } from '@/types'

interface BudgetGuardProps {
  children: React.ReactNode
  message?: string
}

export function BudgetGuard({ 
  children, 
  message = "Bu sayfayı görüntüleyebilmek için önce bütçe bilgilerinizi girmeniz gerekiyor." 
}: BudgetGuardProps) {
  const navigate = useNavigate()

  const { data: budgetRes, isLoading } = useQuery({
    queryKey: ['budget-latest'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any>>('/budget/latest')
      return res.data.data
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <LoadingSkeleton type="form" rows={3} />
      </div>
    )
  }

  // Calculate total income from budget entries if available
  const entries = budgetRes?.entries || []
  const totalIncome = entries.reduce((acc: number, curr: any) => 
    curr.type === 'income' ? acc + Number(curr.amount) : acc
  , 0)

  if (!budgetRes || totalIncome === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 animate-in fade-in duration-300">
        <div className="bg-white p-8 rounded-xl border-2 border-[#0A2540] shadow-md flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-[#0A2540]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-3">Bütçe Bilgisi Gerekli</h2>
          <p className="text-[#64748B] mb-8 max-w-md">
            {message}
          </p>
          <Button 
            onClick={() => navigate('/budget')} 
            className="bg-[#0A2540] hover:bg-[#1B4F8A] text-white px-8 py-6 rounded-lg font-medium shadow-sm transition-all"
          >
            Bütçe Sayfasına Git
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
