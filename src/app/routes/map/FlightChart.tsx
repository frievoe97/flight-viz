type ChartPoint = {
  distanceKm: number
  altitudeFt: number | null
  speedKts: number | null
}

function buildPath(
  data: ChartPoint[],
  valueAccessor: (p: ChartPoint) => number | null,
  xAccessor: (p: ChartPoint) => number,
  yAccessor: (v: number) => number
) {
  let path = ''
  let hasSegment = false
  for (const point of data) {
    const value = valueAccessor(point)
    if (!Number.isFinite(value)) {
      hasSegment = false
      continue
    }
    const x = xAccessor(point)
    const y = yAccessor(value as number)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      hasSegment = false
      continue
    }
    path += hasSegment ? ` L ${x} ${y}` : `M ${x} ${y}`
    hasSegment = true
  }
  return path
}

export function FlightChart({ data }: { data: ChartPoint[] }) {
  if (!data?.length) return null

  const chartWidth = 720
  const chartHeight = 150
  const padding = { top: 22, right: 46, bottom: 28, left: 46 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  const lastPoint = data[data.length - 1]
  const maxDistance = Number.isFinite(lastPoint?.distanceKm)
    ? (lastPoint.distanceKm as number)
    : data.length > 1
    ? data.length - 1
    : 1
  const effectiveDistance = maxDistance > 0 ? maxDistance : 1

  const altitudeValues = data.map((p) => p.altitudeFt).filter((v) => Number.isFinite(v as number)) as number[]
  const speedValues = data.map((p) => p.speedKts).filter((v) => Number.isFinite(v as number)) as number[]
  const maxAltitude = altitudeValues.length ? Math.max(...altitudeValues) : 0
  const maxSpeed = speedValues.length ? Math.max(...speedValues) : 0
  const altitudeScale = maxAltitude > 0 ? maxAltitude : 1
  const speedScale = maxSpeed > 0 ? maxSpeed : 1

  const toX = (point: ChartPoint) =>
    padding.left +
    (Number.isFinite(point.distanceKm)
      ? ((point.distanceKm as number) / effectiveDistance) * innerWidth
      : 0)

  const toYAltitude = (value: number) => padding.top + innerHeight - (value / altitudeScale) * innerHeight
  const toYSpeed = (value: number) => padding.top + innerHeight - (value / speedScale) * innerHeight

  const altitudePath = buildPath(data, (p) => p.altitudeFt, toX, toYAltitude)
  const speedPath = buildPath(data, (p) => p.speedKts, toX, toYSpeed)

  return (
    <div className="w-full overflow-hidden">
      <svg className="w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Flight chart">
        <defs>
          <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(168, 85, 247, 0.4)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0.05)" />
          </linearGradient>
        </defs>
        <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} fill="url(#altitudeGradient)" opacity="0.15" />
        {altitudePath && <path d={altitudePath} stroke="#a855f7" strokeWidth={2} fill="none" />}
        {speedPath && <path d={speedPath} stroke="#38bdf8" strokeWidth={1.5} fill="none" opacity={0.9} />}
      </svg>
    </div>
  )
}

export default FlightChart

