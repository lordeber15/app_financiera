export function centsToAmount(cents: number): number {
  return cents / 100
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100)
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency }).format(centsToAmount(cents))
  } catch {
    return `${currency} ${centsToAmount(cents).toFixed(2)}`
  }
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
