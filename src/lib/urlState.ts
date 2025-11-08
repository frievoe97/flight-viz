const isBrowser = typeof window !== 'undefined'

const shouldDelete = (value: string | null | undefined) =>
  value == null || value === '' || (typeof value === 'string' && value.trim() === '')

export type UrlUpdates = Record<string, string | null | undefined>

export function getCurrentSearchParams(): URLSearchParams {
  if (!isBrowser) return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

export function replaceSearchParams(updates: UrlUpdates) {
  if (!isBrowser) return
  const url = new URL(window.location.href)
  const params = url.searchParams
  Object.entries(updates).forEach(([key, value]) => {
    if (shouldDelete(value)) {
      params.delete(key)
    } else if (typeof value === 'string') {
      params.set(key, value)
    }
  })
  const next =
    url.pathname + (params.toString().length ? `?${params.toString()}` : '') + url.hash
  window.history.replaceState(null, '', next)
}
