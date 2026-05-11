// ── Auth ────────────────────────────────────────────────────────────
export interface User {
  id: string
  username: string
  email: string
  created_at: string
}

// ── Profile ─────────────────────────────────────────────────────────
export interface Profile {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  age: number | null
  marital_status: string | null
  employment_type: string | null
  education: string | null
  dependents: number
  city: string | null
  created_at: string
  updated_at: string
}

export interface ProfileUpdateRequest {
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
  age?: number
  marital_status?: string
  employment_type?: string
  education?: string
  dependents?: number
  city?: string
}

// ── Budget ──────────────────────────────────────────────────────────
export interface BudgetEntry {
  id: string
  period_id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  is_fixed: boolean
  is_loan_payment: boolean
  note: string | null
  created_at: string
}

export interface BudgetPeriod {
  id: string
  month: number
  year: number
  entries: BudgetEntry[]
}

export interface BudgetEntryCreate {
  type: 'income' | 'expense'
  category: string
  amount: number
  is_fixed: boolean
  is_loan_payment: boolean
  note?: string
}

export interface BudgetPeriodRequest {
  month: number
  year: number
  entries: BudgetEntryCreate[]
}

export interface HealthScore {
  score: number
  savings_rate: number
  dti_ratio: number
  emergency_fund_ratio: number
  fixed_expense_ratio: number
  details: Record<string, unknown>
}

// ── Credit ──────────────────────────────────────────────────────────
export interface ShapFactor {
  feature: string
  feature_tr: string
  direction: '+' | '-'
  shap_value: number
  impact_label: string
}

export interface Counterfactual {
  changes: Record<string, { from: unknown; to: unknown }>
}

export interface CreditResult {
  analysis_id: string | null
  risk_score: number
  approval_probability: number
  approved: boolean
  approval_band: string
  optimal_threshold: number
  estimated_interest_rate: number | null
  estimated_interest_rate_pct: string | null
  is_anomaly: boolean
  shap_factors: ShapFactor[]
  counterfactuals: Counterfactual[]
  model_version: string
  summary: string
}

export interface CreditAnalyzeRequest {
  loan_amount: number
  loan_term: number
  loan_purpose: string
  interest_rate: number
  credit_score: number
  num_credit_lines: number
  has_mortgage: boolean
  has_co_signer: boolean
  months_employed?: number
  income_override?: number
}

// ── Goals ───────────────────────────────────────────────────────────
export type GoalCategory = 'acil_fon' | 'tatil' | 'ev' | 'araç' | 'eğitim' | 'diğer'

export interface Goal {
  id: string
  user_id: string
  title: string
  category: GoalCategory | null
  description: string | null
  target_amount: number
  current_amount: number
  monthly_target: number | null
  deadline: string | null
  is_completed: boolean
  created_at: string
}

export interface GoalCreateRequest {
  title: string
  category?: GoalCategory
  description?: string
  target_amount: number
  current_amount?: number
  monthly_target?: number
  deadline?: string
  is_completed?: boolean
}

export interface GoalUpdateRequest {
  title?: string
  category?: GoalCategory
  description?: string
  target_amount?: number
  current_amount?: number
  monthly_target?: number
  deadline?: string
  is_completed?: boolean
}

// ── Alerts ──────────────────────────────────────────────────────────
export interface Alert {
  id: string
  rule_id: string
  level: 'info' | 'warning' | 'danger'
  title: string
  message: string
  is_read: boolean
  is_dismissed: boolean
  triggered_at: string
  created_at: string
}

// ── Chat ────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ── Investment ──────────────────────────────────────────────────────
export interface InvestmentProfile {
  id: string
  user_id: string
  risk_score: number | null
  risk_level: string | null
  questionnaire_answers: Array<Record<string, unknown>> | Record<string, unknown> | null
  recommended_instruments: string[] | Array<Record<string, unknown>> | null
  created_at: string
  updated_at: string
}

// ── Simulator ───────────────────────────────────────────────────────
export interface LoanSimulationRequest {
  amount: number
  months: number
  interest_rate: number
  current_income: number
  current_debt_payments: number
}

export interface SimulationResult {
  monthly_payment: number
  total_payment: number
  total_interest: number
  old_dti: number
  new_dti: number
  is_dti_safe: boolean
}

// ── Report ──────────────────────────────────────────────────────────
export interface Report {
  id: string
  month: number
  year: number
  health_score: number | null
  summary_data: Record<string, unknown> | null
  insights: string[] | Array<Record<string, unknown>> | null
  generated_at: string
}

// ── API Response ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}
