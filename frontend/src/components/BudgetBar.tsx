export function BudgetBar({ pct, color }: { pct: number | null; color: string }) {
  if (pct === null) {
    return <div className="h-2 w-full rounded-full bg-slate-100" />
  }
  const clamped = Math.min(pct, 100)
  const barColor = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : color

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, backgroundColor: barColor }}
      />
    </div>
  )
}
