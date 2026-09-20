import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '../components/Card'
import { BudgetBar } from '../components/BudgetBar'
import { useMonthReport, useSettings } from '../api/hooks'
import { currentMonth, formatMoney, formatMonthLabel } from '../lib/format'

export function Dashboard() {
  const [month, setMonth] = useState(currentMonth())
  const { data: report, isLoading } = useMonthReport(month)
  const { data: settings } = useSettings()
  const currency = settings?.currency ?? 'PEN'

  const chartData =
    report?.by_category
      .filter((c) => c.total_cents > 0)
      .map((c) => ({ name: c.name, value: c.total_cents, color: c.color })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <Card>
        <p className="text-sm text-slate-500 capitalize">{formatMonthLabel(month)}</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">
          {report ? formatMoney(report.total_cents, currency) : '—'}
        </p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Gasto por categoría</h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : !report?.by_category.length ? (
            <p className="text-sm text-slate-500">Sin categorías aún.</p>
          ) : (
            <ul className="space-y-3">
              {report.by_category.map((cat) => (
                <li key={cat.category_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </span>
                    <span className="text-slate-500">
                      {formatMoney(cat.total_cents, currency)}
                      {cat.budget_cents ? ` / ${formatMoney(cat.budget_cents, currency)}` : ''}
                    </span>
                  </div>
                  <BudgetBar pct={cat.pct} color={cat.color} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Distribución</h2>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay gastos este mes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(Number(value ?? 0), currency)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  )
}
