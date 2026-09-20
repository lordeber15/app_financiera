import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  CashCalibrationSample,
  CashCalibrationSampleInput,
  Category,
  CategoryInput,
  Expense,
  ExpenseInput,
  ExpensePage,
  MonthReport,
  Settings,
  SettingsInput,
  WebhookLog,
  WebhookTestResult,
} from './types'

// --- Categorías --------------------------------------------------------

export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['categories', includeInactive],
    queryFn: () => api.get<Category[]>(`/categories${includeInactive ? '?include_inactive=true' : ''}`),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CategoryInput) => api.post<Category>('/categories', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<CategoryInput> & { is_active?: boolean } }) =>
      api.patch<Category>(`/categories/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

// --- Gastos --------------------------------------------------------------

export function useExpenses(params: { month?: string; categoryId?: number; page?: number }) {
  const query = new URLSearchParams()
  if (params.month) query.set('month', params.month)
  if (params.categoryId) query.set('category_id', String(params.categoryId))
  query.set('page', String(params.page ?? 1))

  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.get<ExpensePage>(`/expenses?${query.toString()}`),
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ExpenseInput) => api.post<Expense>('/expenses', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['month-report'] })
      qc.invalidateQueries({ queryKey: ['webhook-logs'] })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<ExpenseInput> }) =>
      api.patch<Expense>(`/expenses/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['month-report'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['month-report'] })
    },
  })
}

// --- Reportes --------------------------------------------------------------

export function useMonthReport(month: string) {
  return useQuery({
    queryKey: ['month-report', month],
    queryFn: () => api.get<MonthReport>(`/reports/month?month=${month}`),
  })
}

// --- Configuración / webhook ------------------------------------------------

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SettingsInput) => api.put<Settings>('/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export interface WebhookTestOverrides {
  webhook_url?: string | null
  webhook_header_name?: string | null
  webhook_header_value?: string | null
}

export function useTestWebhook() {
  const qc = useQueryClient()
  return useMutation({
    // Se le pasan los valores actuales del formulario (aunque no se hayan
    // guardado todavía) para que "Probar" siempre pruebe lo que se ve en pantalla.
    mutationFn: (overrides?: WebhookTestOverrides) =>
      api.post<WebhookTestResult>('/settings/webhook/test', overrides),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-logs'] }),
  })
}

export function useWebhookLogs() {
  return useQuery({
    queryKey: ['webhook-logs'],
    queryFn: () => api.get<WebhookLog[]>('/webhook-logs'),
    refetchInterval: 10_000,
  })
}

// --- Calibración de la cámara para contar efectivo -------------------------

export function useCashCalibrationSamples() {
  return useQuery({
    queryKey: ['cash-calibration-samples'],
    queryFn: () => api.get<CashCalibrationSample[]>('/cash-calibration/samples'),
  })
}

export function useCreateCashCalibrationSample() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CashCalibrationSampleInput) =>
      api.post<CashCalibrationSample>('/cash-calibration/samples', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-calibration-samples'] }),
  })
}

export function useResetCashCalibrationSamples() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (denominationCents: number) =>
      api.delete<void>(`/cash-calibration/samples/${denominationCents}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-calibration-samples'] }),
  })
}

export function useRetryWebhookLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<WebhookLog>(`/webhook-logs/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-logs'] }),
  })
}
