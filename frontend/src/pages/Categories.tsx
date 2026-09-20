import { useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../api/hooks'
import { amountToCents, centsToAmount, formatMoney } from '../lib/format'
import { useSettings } from '../api/hooks'
import type { Category } from '../api/types'

const COLORS = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9', '#eab308', '#ef4444', '#8b5cf6']

export function Categories() {
  const { data: categories, isLoading } = useCategories()
  const { data: settings } = useSettings()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [budget, setBudget] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const currency = settings?.currency ?? 'PEN'

  function resetForm() {
    setName('')
    setColor(COLORS[0])
    setBudget('')
    setEditingId(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const body = {
      name,
      color,
      icon: 'tag',
      monthly_budget_cents: budget ? amountToCents(Number(budget)) : null,
    }
    if (editingId) {
      await updateCategory.mutateAsync({ id: editingId, body })
    } else {
      await createCategory.mutateAsync(body)
    }
    resetForm()
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setName(category.name)
    setColor(category.color)
    setBudget(category.monthly_budget_cents ? String(centsToAmount(category.monthly_budget_cents)) : '')
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta categoría? Si tiene gastos asociados, solo se desactivará.')) return
    await deleteCategory.mutateAsync(id)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Categorías</h1>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-slate-500">Nombre</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Ej. Comida"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Presupuesto mensual ({currency})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? 'ring-2 ring-slate-900' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {editingId ? 'Guardar' : 'Agregar'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
        </form>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Cargando…</p>
        ) : !categories?.length ? (
          <p className="p-4 text-sm text-slate-500">Aún no tienes categorías.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">
                    {cat.monthly_budget_cents ? formatMoney(cat.monthly_budget_cents, currency) : 'Sin presupuesto'}
                  </span>
                  <button
                    onClick={() => startEdit(cat)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
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
    </div>
  )
}
