import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Loader2, Search, X } from 'lucide-react'

type LocationSearchProps = {
  onSelect: (result: {
    position: [number, number]
    zoom?: number
    bounds?: [number, number, number, number]
  }) => void
}

export type LocationSearchHandle = {
  open: () => void
  close: () => void
  toggle: () => void
  focusInput: () => void
  isOpen: () => boolean
}

type GeocodeResult = {
  id: string
  label: string
  subtitle?: string
  position: [number, number]
  zoom?: number
  bounds?: [number, number, number, number]
}

const MIN_QUERY_LENGTH = 2
const FETCH_DELAY_MS = 350

const parseBounds = (raw: unknown): [number, number, number, number] | null => {
  if (!Array.isArray(raw) || raw.length !== 4) return null
  const [minLon, minLat, maxLon, maxLat] = raw.map((value) => Number(value))
  if (
    [minLon, minLat, maxLon, maxLat].some(
      (value) => Number.isNaN(value) || !Number.isFinite(value)
    )
  ) {
    return null
  }
  return [minLon, minLat, maxLon, maxLat]
}

const LocationSearch = forwardRef<LocationSearchHandle, LocationSearchProps>(function LocationSearch(
  { onSelect },
  ref
) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const focusFrameRef = useRef<number | null>(null)
  const openStateRef = useRef(false)

  useEffect(() => {
    openStateRef.current = open
  }, [open])

  const cancelPending = useCallback(() => {
    abortRef.current?.abort()
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const resetSearchState = useCallback(() => {
    cancelPending()
    setQuery('')
    setResults([])
    setActiveIndex(0)
    setError(null)
    setLoading(false)
  }, [cancelPending])

  const focusInput = useCallback(() => {
    if (focusFrameRef.current) {
      window.cancelAnimationFrame(focusFrameRef.current)
    }
    focusFrameRef.current = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const closePanel = useCallback(() => {
    setOpen(false)
    resetSearchState()
  }, [resetSearchState])

  const openPanel = useCallback(() => {
    setOpen((prev) => {
      if (prev) {
        focusInput()
        return prev
      }
      return true
    })
  }, [focusInput])

  const togglePanel = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        focusInput()
      } else {
        resetSearchState()
      }
      return next
    })
  }, [focusInput, resetSearchState])

  useImperativeHandle(
    ref,
    () => ({
      open: () => openPanel(),
      close: () => closePanel(),
      toggle: () => togglePanel(),
      focusInput: () => focusInput(),
      isOpen: () => openStateRef.current,
    }),
    [openPanel, closePanel, togglePanel, focusInput]
  )

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        closePanel()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open, closePanel])

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      cancelPending()
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: '8',
          lang:
            typeof navigator !== 'undefined' && navigator.language
              ? navigator.language.split('-')[0]
              : 'en',
        })
        const response = await fetch(
          `https://photon.komoot.io/api/?${params.toString()}`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          }
        )
        if (!response.ok) throw new Error('request_failed')
        const data = (await response.json()) as {
          bbox?: [number, number, number, number]
          features?: Array<{
            bbox?: [number, number, number, number]
            geometry?: { coordinates?: [number, number] }
            properties?: {
              name?: string
              city?: string
              country?: string
              state?: string
              street?: string
              postcode?: string
              type?: string
              extent?: [number, number, number, number]
            }
          }>
        }
        const mapped =
          data.features
            ?.map<GeocodeResult | null>((feature) => {
              const coords = feature.geometry?.coordinates
              if (!coords || coords.length < 2) return null
              const [lon, lat] = coords
              if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
              const props = feature.properties ?? {}
              const label =
                props.name ??
                props.city ??
                props.state ??
                props.country ??
                props.street ??
                query
              const subtitleParts = [props.city, props.state, props.country]
                .filter(Boolean)
                .map((part) => part as string)
              if (props.postcode) subtitleParts.unshift(props.postcode)
              const subtitle =
                subtitleParts.filter((part, index, arr) => arr.indexOf(part) === index).join(', ') ||
                undefined
              const zoomHint = props.type === 'city' || props.type === 'town' ? 8 : 6
              const bounds =
                parseBounds(props.extent) ?? parseBounds(feature.bbox) ?? parseBounds(data.bbox)
              return {
                id: `${lon.toFixed(4)}-${lat.toFixed(4)}-${label}`,
                label,
                subtitle,
                position: [lon, lat],
                zoom: zoomHint,
                bounds: bounds ?? undefined,
              }
            })
            .filter((item): item is GeocodeResult => Boolean(item)) ?? []
        setResults(mapped)
        setActiveIndex(0)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError('Suche fehlgeschlagen. Bitte später erneut versuchen.')
      } finally {
        setLoading(false)
      }
    }, FETCH_DELAY_MS)

    return () => {
      cancelPending()
    }
  }, [open, query, cancelPending])

  const highlight = (index: number) => {
    setActiveIndex(index)
    const list = listRef.current
    if (!list) return
    const el = list.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }

  const handleSelect = (result: GeocodeResult) => {
    onSelect({ position: result.position, zoom: result.zoom, bounds: result.bounds })
    closePanel()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        const next = (activeIndex + 1) % results.length
        highlight(next)
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        const next = (activeIndex - 1 + results.length) % results.length
        highlight(next)
        break
      }
      case 'Enter': {
        event.preventDefault()
        const current = results[activeIndex] ?? results[0]
        if (current) handleSelect(current)
        break
      }
      case 'Escape': {
        event.preventDefault()
        closePanel()
        break
      }
    }
  }

  return (
    <div ref={containerRef} className="relative flex items-start">
      <button
        type="button"
        className="controls-btn rounded-full p-2 text-white [box-shadow:rgba(15,23,42,0.45)_0px_6px_18px]"
        style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
        onClick={togglePanel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Orte suchen"
        title="Orte suchen"
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Orte suchen"
          className="absolute left-full top-0 z-20 ml-2 w-72 max-w-[calc(100vw-4rem)] rounded-2xl border border-[color:var(--panel-border)] bg-[#0f172a]/95 text-white shadow-2xl backdrop-blur"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <Search className="h-4 w-4 text-white/60" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ort suchen..."
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                aria-label="Eingabe löschen"
                className="rounded p-1 text-white/70 hover:bg-white/10"
                onClick={() => {
                  setQuery('')
                  setActiveIndex(0)
                  setResults([])
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto py-1" role="listbox">
            {!query.trim() ? (
              <div className="px-3 py-4 text-sm text-white/70">
                Tippe mindestens {MIN_QUERY_LENGTH} Zeichen, um die Suche zu starten.
              </div>
            ) : loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Suche läuft...
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-sm text-red-300">{error}</div>
            ) : results.length ? (
              <ul ref={listRef}>
                {results.map((result, index) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      data-index={index}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start hover:bg-white/10 focus:bg-white/10 ${
                        index === activeIndex ? 'bg-white/10' : ''
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleSelect(result)}
                    >
                      <span className="text-sm font-semibold leading-tight">{result.label}</span>
                      {result.subtitle ? (
                        <span className="text-xs text-white/70">{result.subtitle}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-4 text-sm text-white/70">
                Keine Treffer. Bitte Suchbegriff anpassen.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
})

export default LocationSearch
