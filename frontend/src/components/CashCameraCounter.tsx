import { useState } from 'react'
import { CameraCapture } from './CameraCapture'
import {
  DENOMINATIONS_CENTS,
  classify,
  extractFeatures,
  getProfiles,
  samplesFromApi,
  type ClassificationResult,
} from '../lib/cashRecognition'
import { useCashCalibrationSamples } from '../api/hooks'
import { formatMoney } from '../lib/format'

type CashCameraCounterProps = {
  onConfirm: (denominationCents: number) => void
}

export function CashCameraCounter({ onConfirm }: CashCameraCounterProps) {
  const [autoCapture, setAutoCapture] = useState(true)
  const [pending, setPending] = useState<ClassificationResult | null>(null)
  // true mientras el billete confirmado siga en el recuadro (recuadro en verde);
  // lo limpia `handleCleared` cuando la cámara detecta la retirada.
  const [confirmed, setConfirmed] = useState(false)

  const { data: apiSamples, isLoading } = useCashCalibrationSamples()
  const profiles = getProfiles(samplesFromApi(apiSamples ?? []))
  const calibratedCents = new Set(profiles.map((p) => p.denominationCents))

  if (isLoading) {
    return <p className="text-sm text-slate-500">Cargando calibración…</p>
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Aún no has calibrado ninguna denominación. Ve a la pestaña "Calibración" y toma al menos una foto de
        referencia antes de usar la cámara para contar.
      </div>
    )
  }

  function handleCapture(video: HTMLVideoElement) {
    const features = extractFeatures(video, video.videoWidth, video.videoHeight)
    const result = classify(features, profiles)
    if (result) setPending(result)
  }

  function handleConfirm(denominationCents: number) {
    onConfirm(denominationCents)
    setPending(null)
    setConfirmed(true)
  }

  // La cámara emite esto al detectar movimiento sostenido tras una captura: el
  // objeto salió del recuadro, así que se cierra el panel y se apaga el verde.
  function handleCleared() {
    setPending(null)
    setConfirmed(false)
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={autoCapture}
          onChange={(e) => setAutoCapture(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Captura automática al detectar un billete/moneda quieto
      </label>

      <CameraCapture
        autoCapture={autoCapture}
        confirmed={confirmed}
        onCapture={handleCapture}
        onCleared={handleCleared}
      />

      {pending && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">
            {pending.confidence === 'alta' ? 'Sugerencia, toca para confirmar:' : '🤔 No muy seguro, revisa bien:'}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DENOMINATIONS_CENTS.map((denomination) => {
              const isBest = denomination === pending.bestDenominationCents
              const isCalibrated = calibratedCents.has(denomination)
              return (
                <button
                  key={denomination}
                  type="button"
                  title={isCalibrated ? undefined : 'Sin calibrar'}
                  onClick={() => handleConfirm(denomination)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                    isBest
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : isCalibrated
                        ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                        : 'border-dashed border-slate-300 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {formatMoney(denomination, 'PEN')}
                </button>
              )
            })}
          </div>
          {pending.confidence !== 'alta' && pending.candidates[1] && (
            <p className="mt-2 text-xs text-slate-500">
              También podría ser {formatMoney(pending.candidates[1].denominationCents, 'PEN')}.
            </p>
          )}
          <button
            type="button"
            onClick={() => setPending(null)}
            className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Descartar (no era ningún billete/moneda)
          </button>
        </div>
      )}
    </div>
  )
}
