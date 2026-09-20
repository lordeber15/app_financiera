import { useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import { CashCameraCounter } from '../components/CashCameraCounter'
import { CashCalibration } from '../components/CashCalibration'
import { DENOMINATIONS_CENTS } from '../lib/cashRecognition'
import { formatMoney } from '../lib/format'

type CashLine = {
  id: string
  denominationCents: number
  quantity: number
}

type Mode = 'manual' | 'camera' | 'calibration'

const MODE_LABELS: Record<Mode, string> = {
  manual: 'Manual',
  camera: 'Cámara',
  calibration: 'Calibración',
}

export function CashCount() {
  const [mode, setMode] = useState<Mode>('manual')
  const [lines, setLines] = useState<CashLine[]>([])
  const [selectedDenomination, setSelectedDenomination] = useState<number | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = lines.reduce((sum, l) => sum + l.denominationCents * l.quantity, 0)

  function resetForm() {
    setSelectedDenomination(null)
    setQuantityInput('')
    setEditingLineId(null)
    setError(null)
  }

  function selectDenomination(denominationCents: number) {
    setSelectedDenomination(denominationCents)
    setQuantityInput('')
    setEditingLineId(null)
    setError(null)
  }

  function startEdit(line: CashLine) {
    setSelectedDenomination(line.denominationCents)
    setQuantityInput(String(line.quantity))
    setEditingLineId(line.id)
    setError(null)
  }

  function addUnits(denominationCents: number, quantity: number) {
    setLines((prev) => {
      const existing = prev.find((l) => l.denominationCents === denominationCents)
      if (existing) {
        return prev.map((l) =>
          l.denominationCents === denominationCents ? { ...l, quantity: l.quantity + quantity } : l,
        )
      }
      return [...prev, { id: crypto.randomUUID(), denominationCents, quantity }]
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (selectedDenomination === null) return

    const quantity = Number(quantityInput)
    if (!quantityInput.trim() || !Number.isInteger(quantity) || quantity <= 0) {
      setError('Ingresa una cantidad entera mayor a 0')
      return
    }

    if (editingLineId) {
      setLines((prev) =>
        prev.map((l) => (l.id === editingLineId ? { ...l, quantity } : l)),
      )
    } else {
      addUnits(selectedDenomination, quantity)
    }

    resetForm()
  }

  function handleCameraConfirm(denominationCents: number) {
    addUnits(denominationCents, 1)
  }

  function handleDeleteLine(id: string) {
    if (!confirm('¿Eliminar esta línea?')) return
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function handleReset() {
    if (lines.length === 0) return
    if (!confirm('¿Reiniciar todo el conteo?')) return
    setLines([])
    resetForm()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Contar efectivo</h1>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === 'manual' && (
        <Card>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DENOMINATIONS_CENTS.map((denomination) => (
              <button
                key={denomination}
                type="button"
                onClick={() => selectDenomination(denomination)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedDenomination === denomination
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {formatMoney(denomination, 'PEN')}
              </button>
            ))}
          </div>

          {selectedDenomination !== null && (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-32">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Cantidad de {formatMoney(selectedDenomination, 'PEN')}
                </label>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={quantityInput}
                  onChange={(e) => {
                    setQuantityInput(e.target.value)
                    setError(null)
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {editingLineId ? 'Guardar cambios' : 'Agregar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
            </form>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </Card>
      )}

      {mode === 'camera' && <CashCameraCounter onConfirm={handleCameraConfirm} />}

      {mode === 'calibration' && <CashCalibration />}

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Conteo</h2>
          <button
            onClick={handleReset}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Reiniciar
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="border-t border-slate-100 p-4 text-sm text-slate-500">
            Aún no has contado ningún billete o moneda.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm text-slate-700">
                  {line.quantity} x {formatMoney(line.denominationCents, 'PEN')} ={' '}
                  <span className="font-semibold text-slate-900">
                    {formatMoney(line.denominationCents * line.quantity, 'PEN')}
                  </span>
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => startEdit(line)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteLine(line.id)}
                    className="text-sm font-medium text-red-500 hover:text-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-4">
          <span className="text-sm font-medium text-slate-500">Total</span>
          <span className="text-3xl font-bold text-slate-900">{formatMoney(total, 'PEN')}</span>
        </div>
      </Card>
    </div>
  )
}
