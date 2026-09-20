import { useRef, useState, type ChangeEvent } from 'react'
import { CameraCapture } from './CameraCapture'
import { DENOMINATIONS_CENTS, extractFeatures, getProfiles, samplesFromApi } from '../lib/cashRecognition'
import {
  useCashCalibrationSamples,
  useCreateCashCalibrationSample,
  useResetCashCalibrationSamples,
} from '../api/hooks'
import { formatMoney } from '../lib/format'

function hsvToCssColor(hue: number, saturation: number, value: number): string {
  return `hsl(${hue.toFixed(0)}, ${(saturation * 100).toFixed(0)}%, ${(value * 60).toFixed(0)}%)`
}

export function CashCalibration() {
  const [activeCameraFor, setActiveCameraFor] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadFor = useRef<number | null>(null)

  const { data: apiSamples, isLoading } = useCashCalibrationSamples()
  const createSample = useCreateCashCalibrationSample()
  const resetSamples = useResetCashCalibrationSamples()

  const profiles = getProfiles(samplesFromApi(apiSamples ?? []))
  const profileByDenomination = new Map(profiles.map((p) => [p.denominationCents, p]))

  function saveSample(denominationCents: number, features: ReturnType<typeof extractFeatures>) {
    createSample.mutate({
      denomination_cents: denominationCents,
      hue: features.hue,
      saturation: features.saturation,
      value: features.value,
      size_ratio: features.sizeRatio,
    })
  }

  function handleLiveCapture(denominationCents: number, video: HTMLVideoElement) {
    const features = extractFeatures(video, video.videoWidth, video.videoHeight)
    saveSample(denominationCents, features)
    setActiveCameraFor(null)
  }

  function handleUploadClick(denominationCents: number) {
    pendingUploadFor.current = denominationCents
    fileInputRef.current?.click()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const denominationCents = pendingUploadFor.current
    e.target.value = ''
    if (!file || denominationCents === null) return

    const img = new Image()
    img.onload = () => {
      const features = extractFeatures(img, img.naturalWidth, img.naturalHeight)
      saveSample(denominationCents, features)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  function handleReset(denominationCents: number) {
    if (!confirm('¿Borrar las fotos de referencia de esta denominación?')) return
    resetSamples.mutate(denominationCents)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Toma o sube 1 a 5 fotos de referencia por denominación, bien enfocadas y llenando el recuadro guía, para que
        la cámara pueda reconocerlas después. Se guardan en el servidor, así que calibrar desde una computadora
        también sirve para contar después desde el celular.
      </p>
      {isLoading && <p className="text-sm text-slate-500">Cargando calibración…</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {DENOMINATIONS_CENTS.map((denomination) => {
          const profile = profileByDenomination.get(denomination)
          return (
            <li key={denomination} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-6 w-6 shrink-0 rounded-full border border-slate-300"
                    style={{
                      backgroundColor: profile
                        ? hsvToCssColor(profile.avgHue, profile.avgSaturation, profile.avgValue)
                        : '#e2e8f0',
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{formatMoney(denomination, 'PEN')}</p>
                    <p className="text-xs text-slate-500">
                      {profile ? `${profile.sampleCount}/5 fotos` : 'Sin calibrar'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveCameraFor(activeCameraFor === denomination ? null : denomination)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {activeCameraFor === denomination ? 'Cerrar cámara' : 'Tomar foto'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUploadClick(denomination)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Subir archivo
                  </button>
                  {profile && (
                    <button
                      type="button"
                      onClick={() => handleReset(denomination)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      Recalibrar
                    </button>
                  )}
                </div>
              </div>
              {activeCameraFor === denomination && (
                <div className="mt-3">
                  <CameraCapture autoCapture={false} onCapture={(video) => handleLiveCapture(denomination, video)} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
