import { useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import { useCategories, useCreateExpense, useDeleteExpense, useExpenses, useSettings } from '../api/hooks'
import { amountToCents, currentMonth, formatMoney, formatMonthLabel, today } from '../lib/format'

export function Expenses() {
  const [month, setMonth] = useState(currentMonth())
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)

  const { data: categories } = useCategories()
  const { data: settings } = useSettings()
  const { data: expensePage, isLoading } = useExpenses({ month, categoryId, page })
  const createExpense = useCreateExpense()
  const deleteExpense = useDeleteExpense()

  const [amount, setAmount] = useState('')
  const [catId, setCatId] = useState('')
  const [description, setDescription] = useState('')
  const [spentAt, setSpentAt] = useState(today())
  const [error, setError] = useState<string | null>(null)

  const currency = settings?.currency ?? 'PEN'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!catId) {
      setError('Elige una categoría')
      return
    }
    try {
      await createExpense.mutateAsync({
        amount_cents: amountToCents(Number(amount)),
        category_id: Number(catId),
        description: description || null,
        spent_at: spentAt,
      })
      setAmount('')
      setDescription('')
    } catch {
      setError('No se pudo registrar el gasto')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este gasto?')) return
    await deleteExpense.mutateAsync(id)
  }

  const totalPages = expensePage ? Math.max(1, Math.ceil(expensePage.total / expensePage.page_size)) : 1

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Gastos</h1>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-slate-500">Monto ({currency})</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="0.00"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
            <select
              required
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Elegir…</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-slate-500">Nota (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Ej. Almuerzo"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-slate-500">Fecha</label>
            <input
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={createExpense.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {createExpense.isPending ? 'Guardando…' : 'Registrar'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          value={categoryId ?? ''}
          onChange={(e) => {
            setCategoryId(e.target.value ? Number(e.target.value) : undefined)
            setPage(1)
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-sm capitalize text-slate-500">{formatMonthLabel(month)}</span>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Cargando…</p>
        ) : !expensePage?.items.length ? (
          <p className="p-4 text-sm text-slate-500">No hay gastos para este filtro.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expensePage.items.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: expense.category.color }}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {expense.description || expense.category.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {expense.category.name} · {expense.spent_at}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-800">
                    {formatMoney(expense.amount_cents, currency)}
                  </span>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="text-sm font-medium text-red-500 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {expensePage && expensePage.total > expensePage.page_size && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-500">
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
