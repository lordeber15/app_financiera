import { useEffect, useRef, useState } from 'react'
import { GUIDE_BOX } from '../lib/cashRecognition'

type PermissionState = 'requesting' | 'granted' | 'denied' | 'unsupported'
type StillnessState = 'idle' | 'settling' | 'hold'

const MOVEMENT_THRESHOLD = 8
const SETTLE_DURATION_MS = 700
const LOCKOUT_RELEASE_DURATION_MS = 400
const SAMPLE_INTERVAL_MS = 120
const DIFF_CANVAS_WIDTH = 48
const DIFF_CANVAS_HEIGHT = 36

type CameraCaptureProps = {
  autoCapture?: boolean
  // El padre lo pone en true al confirmar un conteo: el recuadro guía se pinta
  // de verde hasta que se emita `onCleared` (retirada del objeto).
  confirmed?: boolean
  onCapture: (video: HTMLVideoElement) => void
  onCleared?: () => void
}

export function CameraCapture({
  autoCapture = false,
  confirmed = false,
  onCapture,
  onCleared,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const diffCanvasRef = useRef<HTMLCanvasElement>(null)
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
    return 'requesting'
  })
  const [retryToken, setRetryToken] = useState(0)
  // `inHold` es el espejo reactivo de `stillnessRef.current === 'hold'`, solo
  // para deshabilitar el botón manual mientras dura la retención.
  const [inHold, setInHold] = useState(false)
  const stillnessRef = useRef<StillnessState>('idle')
  const settleTimerRef = useRef<number | null>(null)
  const lockoutTimerRef = useRef<number | null>(null)
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null)
  const onCaptureRef = useRef(onCapture)
  const onClearedRef = useRef(onCleared)
  const autoCaptureRef = useRef(autoCapture)

  useEffect(() => {
    onCaptureRef.current = onCapture
    onClearedRef.current = onCleared
    autoCaptureRef.current = autoCapture
  })

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return

    let stream: MediaStream | null = null
    let cancelled = false
    setPermission('requesting')

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }
        setPermission('granted')
        s.getVideoTracks().forEach((track) => {
          track.onended = () => setPermission('denied')
        })
      })
      .catch(() => {
        if (!cancelled) setPermission('denied')
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [retryToken])

  useEffect(() => {
    if (permission !== 'granted') return

    const canvas = diffCanvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx) return

    function enterHold() {
      stillnessRef.current = 'hold'
      setInHold(true)
    }

    function leaveHold() {
      stillnessRef.current = 'idle'
      setInHold(false)
      prevFrameRef.current = null
    }

    function advanceStillness(diffScore: number, video: HTMLVideoElement) {
      const state = stillnessRef.current
      const stillNow = diffScore <= MOVEMENT_THRESHOLD

      if (state === 'idle') {
        if (stillNow && autoCaptureRef.current) {
          stillnessRef.current = 'settling'
          settleTimerRef.current = window.setTimeout(() => {
            if (stillnessRef.current === 'settling') {
              enterHold()
              onCaptureRef.current(video)
            }
          }, SETTLE_DURATION_MS)
        }
        return
      }

      if (state === 'settling') {
        if (!stillNow) {
          if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
          stillnessRef.current = 'idle'
        }
        return
      }

      // hold: el objeto ya se capturó (automática o manual) y el estado se
      // mantiene aunque el padre cierre o descarte el panel de sugerencia; solo
      // se libera cuando hay movimiento sostenido (se retiró el objeto), que es
      // además cuando se avisa al padre para limpiar su estado pendiente.
      if (!stillNow) {
        if (lockoutTimerRef.current) window.clearTimeout(lockoutTimerRef.current)
        lockoutTimerRef.current = window.setTimeout(() => {
          if (stillnessRef.current !== 'hold') return
          leaveHold()
          onClearedRef.current?.()
        }, LOCKOUT_RELEASE_DURATION_MS)
      } else if (lockoutTimerRef.current) {
        window.clearTimeout(lockoutTimerRef.current)
        lockoutTimerRef.current = null
      }
    }

    const interval = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0) return

      const gx = GUIDE_BOX.x * video.videoWidth
      const gy = GUIDE_BOX.y * video.videoHeight
      const gw = GUIDE_BOX.width * video.videoWidth
      const gh = GUIDE_BOX.height * video.videoHeight
      ctx.drawImage(video, gx, gy, gw, gh, 0, 0, DIFF_CANVAS_WIDTH, DIFF_CANVAS_HEIGHT)
      const frame = ctx.getImageData(0, 0, DIFF_CANVAS_WIDTH, DIFF_CANVAS_HEIGHT).data

      const prev = prevFrameRef.current
      if (prev) {
        let sum = 0
        let count = 0
        for (let i = 0; i < frame.length; i += 4) {
          const gray = (frame[i] + frame[i + 1] + frame[i + 2]) / 3
          const prevGray = (prev[i] + prev[i + 1] + prev[i + 2]) / 3
          sum += Math.abs(gray - prevGray)
          count++
        }
        advanceStillness(sum / count, video)
      }
      prevFrameRef.current = frame
    }, SAMPLE_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
      if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
      if (lockoutTimerRef.current) window.clearTimeout(lockoutTimerRef.current)
      // La cámara se reinicia o desmonta: el siguiente arranque parte limpio.
      stillnessRef.current = 'idle'
      setInHold(false)
      prevFrameRef.current = null
    }
    // La retención post-captura no depende de props del padre: cambiar
    // `pending`/`confirmed` en el padre no reinicia este bucle.
  }, [permission])

  function handleManualCapture() {
    if (inHold || permission !== 'granted' || !videoRef.current) return
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current)
    stillnessRef.current = 'hold'
    setInHold(true)
    onCaptureRef.current(videoRef.current)
  }

  if (permission === 'unsupported') {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        La cámara requiere una conexión segura (HTTPS). Si estás probando desde el celular en desarrollo, usa{' '}
        <code className="rounded bg-amber-100 px-1">npm run dev:mobile</code> y abre la URL HTTPS que muestre.
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        No se pudo acceder a la cámara (permiso denegado o revocado).{' '}
        <button
          type="button"
          onClick={() => setRetryToken((n) => n + 1)}
          className="font-medium underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-black">
        {/* Sin aspect-ratio fijo ni object-fit: cover — el video mantiene su
            relación de aspecto nativa para que el recuadro guía (posicionado
            en % sobre esta misma caja) coincida exactamente con la región que
            `extractFeatures` recorta usando fracciones de videoWidth/videoHeight. */}
        <video ref={videoRef} autoPlay playsInline muted className="block w-full" />
        <div
          className={`pointer-events-none absolute rounded-lg border-4 transition-colors duration-200 ${
            confirmed ? 'border-emerald-400' : 'border-white/80'
          }`}
          style={{
            left: `${GUIDE_BOX.x * 100}%`,
            top: `${GUIDE_BOX.y * 100}%`,
            width: `${GUIDE_BOX.width * 100}%`,
            height: `${GUIDE_BOX.height * 100}%`,
          }}
        />
        <canvas ref={diffCanvasRef} width={DIFF_CANVAS_WIDTH} height={DIFF_CANVAS_HEIGHT} className="hidden" />
      </div>
      <button
        type="button"
        onClick={handleManualCapture}
        disabled={permission !== 'granted' || inHold}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        Capturar
      </button>
    </div>
  )
}
