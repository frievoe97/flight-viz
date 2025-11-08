// Shared formatting utilities for numbers, distances, altitudes and durations

export const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function formatKm(value?: number | null, precise = false): string {
  if (!Number.isFinite(value as number)) return '–'
  const n = value as number
  return `${(precise ? nf1 : nf0).format(n)} km`
}

export function formatFt(value?: number | null): string {
  if (!Number.isFinite(value as number)) return '–'
  return `${nf0.format(value as number)} ft`
}

export function formatDuration(seconds?: number | null): string {
  if (!Number.isFinite(seconds as number)) return '–'
  const total = Math.round(seconds as number)
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours === 0 && minutes === 0) return '< 1 min'
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

