import { useEffect, useMemo, useRef, useState } from 'react'
import { ArcLayer, PathLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import { COORDINATE_SYSTEM } from '@deck.gl/core'
import type { Theme } from '@/lib/theme/useTheme'

export type RouteArcDatum = {
  id: string
  name: string
  source: [number, number]
  target: [number, number]
  avgAltitudeFt: number | null
  distanceKm: number
  originCode: string | null
  destinationCode: string | null
}

// no extra types needed for animated PathLayer

export function useRoutesLayer({
  routes,
  isActive,
  widthScale,
  height,
  opacity,
  theme,
  animate = false,
  isPaused = false,
}: {
  routes: RouteArcDatum[]
  isActive: boolean
  widthScale: number
  height: number
  opacity: number
  theme: Theme
  animate?: boolean
  isPaused?: boolean
}): Layer | Layer[] | null {
  const [timeSec, setTimeSec] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!isActive || !animate || !routes.length || isPaused) return () => undefined
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTimeSec((t) => t + dt)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isActive, animate, routes.length, isPaused])

  return useMemo(() => {
    if (!isActive || !routes.length) return null

    // --- statische (nicht animierte) Variante: ArcLayer wie gehabt ---
    if (!animate) {
      const baseColor =
        theme === 'dark'
          ? ([255, 255, 255, Math.round(opacity * 255)] as [number, number, number, number])
          : ([0, 0, 0, Math.round(opacity * 255)] as [number, number, number, number])

      return new ArcLayer<RouteArcDatum>({
        id: 'flight-routes',
        data: routes,
        pickable: true,
        greatCircle: true,
        opacity,
        getSourcePosition: (d) => d.source,
        getTargetPosition: (d) => d.target,
        getSourceColor: () => baseColor,
        getTargetColor: () => baseColor,
        getWidth: (d) => Math.min(0 + Math.sqrt(Math.max(d.distanceKm, 1)) * 0.18, 16),
        getHeight: () => height,
        widthUnits: 'pixels',
        widthScale: widthScale * 0.5,
      })
    }

    // ----------------- animierte Variante: PathLayer, der den Pfad nach und nach sichtbar macht -----------------

    // Geschwindigkeit & Diskretisierung
    const KM_PER_SECOND = 300
    const SAMPLES = 50 // mehr Stützpunkte => glattere Great-Circle-Kurve
    // Sichtbare Bogenhöhe: skaliere das UI-"height" (0..~2) auf Meter
    // 0.2 → ca. 12 km, 1.0 → 60 km
    const amplitudeM = Math.max(0, height) * 600000

    // Helper: Winkel-/Koordinaten-Konvertierungen
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const toDeg = (rad: number) => (rad * 180) / Math.PI
    const lonLatToVec3 = (lonDeg: number, latDeg: number) => {
      const lon = toRad(lonDeg)
      const lat = toRad(latDeg)
      const x = Math.cos(lat) * Math.cos(lon)
      const y = Math.cos(lat) * Math.sin(lon)
      const z = Math.sin(lat)
      return [x, y, z] as [number, number, number]
    }
    const vec3ToLonLat = (v: [number, number, number]) => {
      const [x, y, z] = v
      const lon = Math.atan2(y, x)
      const hyp = Math.sqrt(x * x + y * y)
      const lat = Math.atan2(z, hyp)
      return [toDeg(lon), toDeg(lat)] as [number, number]
    }
    const slerp = (a: [number, number, number], b: [number, number, number], t: number) => {
      let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
      dot = Math.max(-1, Math.min(1, dot))
      const omega = Math.acos(dot)
      if (omega < 1e-6) return a
      const s0 = Math.sin((1 - t) * omega) / Math.sin(omega)
      const s1 = Math.sin(t * omega) / Math.sin(omega)
      return [s0 * a[0] + s1 * b[0], s0 * a[1] + s1 * b[1], s0 * a[2] + s1 * b[2]] as [
        number,
        number,
        number,
      ]
    }
    const haversineKm = (a: [number, number], b: [number, number]) => {
      const R = 6371
      const dLat = toRad(b[1] - a[1])
      const dLon = toRad(b[0] - a[0])
      const lat1 = toRad(a[1])
      const lat2 = toRad(b[1])
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
    }

    // Precompute pro Route: Stützpunkte + Zeitmarken
    const samplesById = new Map<
      string,
      { points: [number, number, number][]; tsSec: number[]; duration: number }
    >()
    for (const r of routes) {
      const a = lonLatToVec3(r.source[0], r.source[1])
      const b = lonLatToVec3(r.target[0], r.target[1])

      const points: [number, number, number][] = []
      const cumKm: number[] = [0]

      let prevLonLat: [number, number] | null = null
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES
        const vec = slerp(a, b, t)
        const [lon, lat] = vec3ToLonLat(vec)
        if (prevLonLat) {
          cumKm.push(cumKm[cumKm.length - 1] + haversineKm(prevLonLat, [lon, lat]))
        }
        prevLonLat = [lon, lat]
        const z = Math.sin(Math.PI * t) * amplitudeM // Meter
        points.push([lon, lat, z])
      }

      const tsSec = cumKm.map((km) => km / KM_PER_SECOND)
      const duration = tsSec[tsSec.length - 1] || 0
      samplesById.set(r.id, { points, tsSec, duration })
    }

    const baseColor =
      theme === 'dark'
        ? ([255, 255, 255, Math.round(opacity * 255)] as [number, number, number, number])
        : ([0, 0, 0, Math.round(opacity * 255)] as [number, number, number, number])

    const layer = new PathLayer<RouteArcDatum>({
      id: 'flight-routes-animated',
      data: routes,
      pickable: true,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      widthUnits: 'pixels',
      widthScale: Math.max(0.1, widthScale * 0.5),
      getColor: () => baseColor,
      getWidth: (d) => Math.min(16, Math.sqrt(Math.max(d.distanceKm, 1)) * 0.18),
      getPath: (d) => {
        const entry = samplesById.get(d.id)
        if (!entry) return []
        const { points, tsSec, duration } = entry
        if (!duration) return points
        const t = timeSec % duration
        // finde aktuelles Segment
        let idx = 0
        while (idx < tsSec.length - 1 && tsSec[idx + 1] <= t) idx++
        const path: [number, number, number][] = points.slice(0, idx + 1)
        if (idx < tsSec.length - 1) {
          const t0 = tsSec[idx]
          const t1 = tsSec[idx + 1]
          const a = points[idx]
          const b = points[idx + 1]
          const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0
          path.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u])
        }
        return path
      },
      updateTriggers: {
        getPath: [timeSec, height],
        getColor: [opacity, theme],
        getWidth: [widthScale],
      },
    })

    return layer
  }, [routes, isActive, widthScale, height, opacity, theme, animate, timeSec])
}

/* (keine zusätzlichen Geometrie-Helper nötig in der animierten PathLayer-Variante) */
