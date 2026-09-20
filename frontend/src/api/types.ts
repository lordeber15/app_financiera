export interface Category {
  id: number
  name: string
  color: string
  icon: string
  monthly_budget_cents: number | null
  is_active: boolean
}

export interface CategoryInput {
  name: string
  color: string
  icon: string
  monthly_budget_cents: number | null
}

export interface Expense {
  id: number
  amount_cents: number
  description: string | null
  spent_at: string
  category: Category
}

export interface ExpenseInput {
  amount_cents: number
  category_id: number
  description: string | null
  spent_at: string
}

export interface ExpensePage {
  items: Expense[]
  total: number
  page: number
  page_size: number
}

export interface CategoryTotal {
  category_id: number
  name: string
  color: string
  icon: string
  total_cents: number
  budget_cents: number | null
  pct: number | null
}

export interface MonthReport {
  month: string
  total_cents: number
  by_category: CategoryTotal[]
}

export interface Settings {
  currency: string
  timezone: string
  webhook_url: string | null
  webhook_header_name: string | null
  webhook_header_value: string | null
  webhook_enabled: boolean
  notify_expense: boolean
  notify_budget: boolean
  budget_thresholds: string
  summary_daily_enabled: boolean
  summary_daily_time: string
  summary_weekly_enabled: boolean
  summary_weekly_day: number
  summary_weekly_time: string
}

export type SettingsInput = Partial<Settings>

export interface WebhookTestResult {
  success: boolean
  status_code: number | null
  error: string | null
}

export interface CashCalibrationSample {
  id: number
  denomination_cents: number
  hue: number
  saturation: number
  value: number
  size_ratio: number
  captured_at: string
}

export interface CashCalibrationSampleInput {
  denomination_cents: number
  hue: number
  saturation: number
  value: number
  size_ratio: number
}

export interface WebhookLog {
  id: number
  event_type: string
  payload: Record<string, unknown>
  status_code: number | null
  success: boolean
  error: string | null
  attempts: number
  created_at: string
}
