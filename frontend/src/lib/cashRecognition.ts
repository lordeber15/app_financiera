export const DENOMINATIONS_CENTS = [50, 100, 500, 1000, 2000, 5000, 10000] as const

export type GuideBox = { x: number; y: number; width: number; height: number }

// Recuadro guía central (fracción del ancho/alto de la fuente) usado tanto para
// recortar el frame de video en vivo como una foto subida, para que las features
// extraídas sean comparables entre calibración y conteo.
export const GUIDE_BOX: GuideBox = { x: 0.2, y: 0.15, width: 0.6, height: 0.6 }

export type ConfidenceLevel = 'alta' | 'media' | 'baja'

export type ExtractedFeatures = {
  hue: number
  saturation: number
  value: number
  sizeRatio: number
}

// Una muestra de calibración ya guardada (backend), con su denominación.
export type CalibrationSample = ExtractedFeatures & {
  denominationCents: number
}

export type DenominationProfile = {
  denominationCents: number
  avgHue: number
  avgSaturation: number
  avgValue: number
  avgSizeRatio: number
  sampleCount: number
}

export type ClassificationCandidate = {
  denominationCents: number
  distance: number
}

export type ClassificationResult = {
  bestDenominationCents: number
  confidence: ConfidenceLevel
  candidates: ClassificationCandidate[]
}

const FEATURE_CANVAS_SIZE = 120
const BORDER_MARGIN = Math.round(FEATURE_CANVAS_SIZE * 0.1)
const OBJECT_COLOR_THRESHOLD = 45
const MIN_OBJECT_FRACTION = 0.05
const MAX_OBJECT_FRACTION = 0.95

let featureCanvas: HTMLCanvasElement | null = null

function getFeatureCanvas(): HTMLCanvasElement {
  if (!featureCanvas) {
    featureCanvas = document.createElement('canvas')
    featureCanvas.width = FEATURE_CANVAS_SIZE
    featureCanvas.height = FEATURE_CANVAS_SIZE
  }
  return featureCanvas
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2)
    else h = 60 * ((rn - gn) / delta + 4)
  }
  if (h < 0) h += 360

  const s = max === 0 ? 0 : delta / max
  const v = max
  return { h, s, v }
}

/**
 * Recorta el recuadro guía de la fuente (video o imagen), separa el objeto del
 * fondo por distancia de color, y devuelve su color promedio (HSV) y su
 * tamaño relativo dentro del recuadro. Sin ML: heurística de color+tamaño,
 * adecuada solo porque se calibra con pocas fotos de referencia por denominación.
 */
export function extractFeatures(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  guideBox: GuideBox = GUIDE_BOX,
): ExtractedFeatures {
  const canvas = getFeatureCanvas()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return { hue: 0, saturation: 0, value: 0, sizeRatio: 1 }
  }

  const sx = guideBox.x * sourceWidth
  const sy = guideBox.y * sourceHeight
  const sw = guideBox.width * sourceWidth
  const sh = guideBox.height * sourceHeight

  ctx.clearRect(0, 0, FEATURE_CANVAS_SIZE, FEATURE_CANVAS_SIZE)
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, FEATURE_CANVAS_SIZE, FEATURE_CANVAS_SIZE)
  const { data } = ctx.getImageData(0, 0, FEATURE_CANVAS_SIZE, FEATURE_CANVAS_SIZE)

  let bgR = 0
  let bgG = 0
  let bgB = 0
  let bgCount = 0
  for (let y = 0; y < FEATURE_CANVAS_SIZE; y++) {
    for (let x = 0; x < FEATURE_CANVAS_SIZE; x++) {
      const onBorder =
        x < BORDER_MARGIN || x >= FEATURE_CANVAS_SIZE - BORDER_MARGIN || y < BORDER_MARGIN || y >= FEATURE_CANVAS_SIZE - BORDER_MARGIN
      if (!onBorder) continue
      const i = (y * FEATURE_CANVAS_SIZE + x) * 4
      bgR += data[i]
      bgG += data[i + 1]
      bgB += data[i + 2]
      bgCount++
    }
  }
  bgR /= bgCount
  bgG /= bgCount
  bgB /= bgCount

  let objR = 0
  let objG = 0
  let objB = 0
  let objCount = 0
  let minX = FEATURE_CANVAS_SIZE
  let maxX = 0
  let minY = FEATURE_CANVAS_SIZE
  let maxY = 0
  let allR = 0
  let allG = 0
  let allB = 0

  for (let y = 0; y < FEATURE_CANVAS_SIZE; y++) {
    for (let x = 0; x < FEATURE_CANVAS_SIZE; x++) {
      const i = (y * FEATURE_CANVAS_SIZE + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      allR += r
      allG += g
      allB += b

      const dr = r - bgR
      const dg = g - bgG
      const db = b - bgB
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)
      if (dist > OBJECT_COLOR_THRESHOLD) {
        objR += r
        objG += g
        objB += b
        objCount++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const totalPixels = FEATURE_CANVAS_SIZE * FEATURE_CANVAS_SIZE
  const objectFraction = objCount / totalPixels

  let avgR: number
  let avgG: number
  let avgB: number
  let sizeRatio: number

  if (objectFraction >= MIN_OBJECT_FRACTION && objectFraction <= MAX_OBJECT_FRACTION) {
    avgR = objR / objCount
    avgG = objG / objCount
    avgB = objB / objCount
    sizeRatio = ((maxX - minX + 1) * (maxY - minY + 1)) / totalPixels
  } else {
    // El objeto llena casi todo el recuadro (billete bien acercado) o casi
    // nada (recuadro vacío): un bounding-box de "objeto" sería degenerado,
    // así que se usa el color promedio de todo el recorte.
    avgR = allR / totalPixels
    avgG = allG / totalPixels
    avgB = allB / totalPixels
    sizeRatio = 1
  }

  const { h, s, v } = rgbToHsv(avgR, avgG, avgB)
  return { hue: h, saturation: s, value: v, sizeRatio }
}

function circularDistanceDegrees(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function featureDistance(sample: ExtractedFeatures, profile: DenominationProfile): number {
  const hueDist = circularDistanceDegrees(sample.hue, profile.avgHue) / 180
  const satDist = Math.abs(sample.saturation - profile.avgSaturation)
  const valDist = Math.abs(sample.value - profile.avgValue)
  const sizeDist = Math.abs(sample.sizeRatio - profile.avgSizeRatio)
  // El matiz es ruido puro en colores casi grises (baja saturación), así que
  // su peso se apaga cuando la muestra o el perfil tienen poca saturación.
  const hueWeight = 0.5 * Math.sqrt(sample.saturation * profile.avgSaturation)
  return hueWeight * hueDist + 0.25 * satDist + 0.2 * sizeDist + 0.05 * valDist
}

export function classify(sample: ExtractedFeatures, profiles: DenominationProfile[]): ClassificationResult | null {
  if (profiles.length === 0) return null

  const candidates = profiles
    .map((profile) => ({ denominationCents: profile.denominationCents, distance: featureDistance(sample, profile) }))
    .sort((a, b) => a.distance - b.distance)

  const [best, second] = candidates
  const margin = second ? (second.distance - best.distance) / (second.distance + best.distance + 1e-6) : 1

  let confidence: ConfidenceLevel
  if (!second || (best.distance < 0.25 && margin > 0.25)) {
    confidence = 'alta'
  } else if (best.distance < 0.4) {
    confidence = 'media'
  } else {
    confidence = 'baja'
  }

  return { bestDenominationCents: best.denominationCents, confidence, candidates }
}

// Convierte la forma snake_case que devuelve la API (ver `CashCalibrationSample`
// en frontend/src/api/types.ts) a `CalibrationSample`, sin que esta librería
// tenga que importar tipos de la capa de API (tipado estructural).
export function samplesFromApi(
  apiSamples: { denomination_cents: number; hue: number; saturation: number; value: number; size_ratio: number }[],
): CalibrationSample[] {
  return apiSamples.map((s) => ({
    denominationCents: s.denomination_cents,
    hue: s.hue,
    saturation: s.saturation,
    value: s.value,
    sizeRatio: s.size_ratio,
  }))
}

function averageHueCircular(hues: number[]): number {
  const sumSin = hues.reduce((sum, h) => sum + Math.sin((h * Math.PI) / 180), 0)
  const sumCos = hues.reduce((sum, h) => sum + Math.cos((h * Math.PI) / 180), 0)
  let angle = (Math.atan2(sumSin / hues.length, sumCos / hues.length) * 180) / Math.PI
  if (angle < 0) angle += 360
  return angle
}

export function getProfiles(samples: CalibrationSample[]): DenominationProfile[] {
  const byDenomination = new Map<number, CalibrationSample[]>()
  for (const sample of samples) {
    const existing = byDenomination.get(sample.denominationCents)
    if (existing) existing.push(sample)
    else byDenomination.set(sample.denominationCents, [sample])
  }

  return Array.from(byDenomination.entries())
    .map(([denominationCents, group]) => ({
      denominationCents,
      avgHue: averageHueCircular(group.map((s) => s.hue)),
      avgSaturation: group.reduce((sum, s) => sum + s.saturation, 0) / group.length,
      avgValue: group.reduce((sum, s) => sum + s.value, 0) / group.length,
      avgSizeRatio: group.reduce((sum, s) => sum + s.sizeRatio, 0) / group.length,
      sampleCount: group.length,
    }))
    .sort((a, b) => a.denominationCents - b.denominationCents)
}
