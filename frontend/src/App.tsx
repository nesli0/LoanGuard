import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'

// Layout
import { AppLayout } from '@/components/layout/AppLayout'

// Auth pages
import { LoginPage }    from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'

// Protected pages
import { DashboardPage }  from '@/pages/DashboardPage'
import { BudgetPage }     from '@/pages/BudgetPage'
import { CreditPage }     from '@/pages/CreditPage'
import { GoalsPage }      from '@/pages/GoalsPage'
import { SimulatorPage }  from '@/pages/SimulatorPage'
import { InvestmentPage } from '@/pages/InvestmentPage'
import { ChatPage }       from '@/pages/ChatPage'
import { AlertsPage }     from '@/pages/AlertsPage'
import { ReportPage }     from '@/pages/ReportPage'
import { ProfilePage }    from '@/pages/ProfilePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected */}
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"  element={<DashboardPage />} />
              <Route path="/budget"     element={<BudgetPage />} />
              <Route path="/credit"     element={<CreditPage />} />
              <Route path="/goals"      element={<GoalsPage />} />
              <Route path="/simulator"  element={<SimulatorPage />} />
              <Route path="/investment" element={<InvestmentPage />} />
              <Route path="/chat"       element={<ChatPage />} />
              <Route path="/alerts"     element={<AlertsPage />} />
              <Route path="/report"     element={<ReportPage />} />
              <Route path="/profile"    element={<ProfilePage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
