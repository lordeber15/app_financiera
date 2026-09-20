import { useEffect, useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import {
  useRetryWebhookLog,
  useSettings,
  useTestWebhook,
  useUpdateSettings,
  useWebhookLogs,
} from '../api/hooks'
import type { SettingsInput } from '../api/types'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function Settings() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const testWebhook = useTestWebhook()
  const { data: logs } = useWebhookLogs()
  const retryLog = useRetryWebhookLog()

  const [form, setForm] = useState<SettingsInput>({})
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  function update<K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await updateSettings.mutateAsync(form)
    setSaved(true)
  }

  async function handleTest() {
    setTestResult(null)
    // Prueba lo que hay escrito en el formulario, se haya guardado o no.
    const result = await testWebhook.mutateAsync({
      webhook_url: form.webhook_url,
      webhook_header_name: form.webhook_header_name,
      webhook_header_value: form.webhook_header_value,
    })
    setTestResult(
      result.success
        ? `✅ Enviado correctamente (HTTP ${result.status_code})`
        : `❌ Falló: ${result.error ?? `HTTP ${result.status_code}`}`
    )
  }

  if (isLoading || !form.currency) return <p className="text-sm text-slate-500">Cargando…</p>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Configuración</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Webhook de n8n</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.webhook_enabled ?? false}
                onChange={(e) => update('webhook_enabled', e.target.checked)}
              />
              Habilitar envío al webhook
            </label>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">URL del webhook</label>
              <input
                value={form.webhook_url ?? ''}
                onChange={(e) => update('webhook_url', e.target.value)}
                placeholder="https://tu-n8n.example.com/webhook/xxxxx"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Header de autenticación (nombre)
                </label>
                <input
                  value={form.webhook_header_name ?? ''}
                  onChange={(e) => update('webhook_header_name', e.target.value)}
                  placeholder="Ej. X-Webhook-Token"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Valor del header</label>
                <input
                  value={form.webhook_header_value ?? ''}
                  onChange={(e) => update('webhook_header_value', e.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={testWebhook.isPending || !form.webhook_url}
                title={!form.webhook_url ? 'Escribe una URL de webhook primero' : undefined}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                {testWebhook.isPending ? 'Probando…' : 'Probar webhook'}
              </button>
              {testResult && <span className="text-sm text-slate-600">{testResult}</span>}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Eventos</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notify_expense ?? false}
                onChange={(e) => update('notify_expense', e.target.checked)}
              />
              Notificar cada gasto registrado
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notify_budget ?? false}
                onChange={(e) => update('notify_budget', e.target.checked)}
              />
              Alertar al superar umbrales de presupuesto ({form.budget_thresholds ?? '80,100'}%)
            </label>

            <div className="border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.summary_daily_enabled ?? false}
                  onChange={(e) => update('summary_daily_enabled', e.target.checked)}
                />
                Resumen diario a las
                <input
                  type="time"
                  value={form.summary_daily_time ?? '21:00'}
                  onChange={(e) => update('summary_daily_time', e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.summary_weekly_enabled ?? false}
                onChange={(e) => update('summary_weekly_enabled', e.target.checked)}
              />
              Resumen semanal el
              <select
                value={form.summary_weekly_day ?? 6}
                onChange={(e) => update('summary_weekly_day', Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                {WEEKDAYS.map((day, idx) => (
                  <option key={day} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
              a las
              <input
                type="time"
                value={form.summary_weekly_time ?? '21:00'}
                onChange={(e) => update('summary_weekly_time', e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">General</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Moneda (código ISO)</label>
              <input
                value={form.currency ?? ''}
                onChange={(e) => update('currency', e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Zona horaria</label>
              <input
                value={form.timezone ?? ''}
                onChange={(e) => update('timezone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateSettings.isPending}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {saved && <span className="text-sm text-emerald-600">Guardado ✓</span>}
        </div>
      </form>

      <Card className="p-0">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          Historial de envíos al webhook
        </h2>
        {!logs?.length ? (
          <p className="p-4 text-sm text-slate-500">Aún no se ha enviado ningún evento.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{log.event_type}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString('es')} · intentos: {log.attempts}
                    {log.error ? ` · ${log.error.slice(0, 80)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      log.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {log.success ? `OK ${log.status_code ?? ''}` : 'Falló'}
                  </span>
                  {!log.success && (
                    <button
                      onClick={() => retryLog.mutate(log.id)}
                      disabled={retryLog.isPending}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Reenviar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
