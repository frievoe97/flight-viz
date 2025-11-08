import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import type { FilterSuggestion, MapFilterField, MapFilterValues } from '../types'

// ========================= Shared UI =========================
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
      <span className="uppercase">{label}</span>
      {children}
    </label>
  )
}

const inputBase =
  'w-full rounded-md border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.6)] px-2 py-1.5 text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[rgba(56,189,248,0.45)]'

// ========================= MultiSelect Suggestion Input =========================

type MultiSelectInputProps = {
  selected?: string[]
  onChange: (values: string[]) => void
  suggestions: FilterSuggestion[]
  placeholder?: string
  ariaLabel?: string
}

function MultiSelectInput({
  selected,
  onChange,
  suggestions,
  placeholder,
  ariaLabel,
}: MultiSelectInputProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const [panelMaxH, setPanelMaxH] = useState<number>(224)

  // options remaining (exclude already selected)
  const sel = selected ?? []
  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = suggestions.filter((s) => !sel.includes(s.value))
    const filtered = q ? base.filter((s) => s.searchKey.includes(q)) : base
    return filtered.slice(0, 100)
  }, [query, suggestions, sel])

  // outside click
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // reposition dropdown (top/bottom + max height)
  const reposition = () => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const vh = window.innerHeight
    const gap = 8
    const desired = Math.min(vh * 0.7, 320)
    const spaceBelow = vh - rect.bottom - gap
    const spaceAbove = rect.top - gap
    if (spaceBelow < 160 && spaceAbove > spaceBelow) {
      setPlacement('top')
      setPanelMaxH(Math.max(128, Math.min(desired, spaceAbove)))
    } else {
      setPlacement('bottom')
      setPanelMaxH(Math.max(128, Math.min(desired, spaceBelow)))
    }
  }

  useEffect(() => {
    if (!open) return
    reposition()
    const onResize = () => reposition()
    const onScroll = () => reposition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, query])

  const commitSelect = (optValue: string | undefined) => {
    if (!optValue) return
    if (sel.includes(optValue)) return
    onChange([...sel, optValue])
    setQuery('')
    setActiveIndex(0)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      e.preventDefault()
      return
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        setActiveIndex((i) => (options.length ? (i + 1) % options.length : 0))
        scrollActiveIntoView()
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        setActiveIndex((i) => (options.length ? (i - 1 + options.length) % options.length : 0))
        scrollActiveIntoView()
        break
      }
      case 'Home': {
        if (!options.length) return
        e.preventDefault()
        setActiveIndex(0)
        scrollActiveIntoView(0)
        break
      }
      case 'End': {
        if (!options.length) return
        e.preventDefault()
        setActiveIndex(options.length - 1)
        scrollActiveIntoView(options.length - 1)
        break
      }
      case 'Enter': {
        if (!open) return
        e.preventDefault()
        commitSelect(options[activeIndex]?.value)
        break
      }
      case 'Escape': {
        setOpen(false)
        break
      }
      case 'Backspace': {
        if (query === '' && sel.length) {
          e.preventDefault()
          const next = [...sel]
          next.pop()
          onChange(next)
        }
        break
      }
    }
  }

  const scrollActiveIntoView = (forcedIndex?: number) => {
    const idx = forcedIndex ?? activeIndex
    const list = listRef.current
    if (!list) return
    const el = list.querySelector<HTMLButtonElement>(`[data-idx="${idx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }

  const clearAll = () => {
    if (sel.length === 0 && query === '') return
    onChange([])
    setQuery('')
    setActiveIndex(0)
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="relative">
        {/* Control */}
        <div
          className={`${inputBase} flex min-h-[2.375rem] items-center gap-1 pr-8 pl-2`}
          onClick={() => {
            inputRef.current?.focus()
            setOpen(true)
          }}
        >
          {/* Selected chips */}
          <div className="flex flex-wrap items-center gap-1">
            {sel.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs"
              >
                {suggestions.find((s) => s.value === val)?.label ?? val}
                <button
                  type="button"
                  aria-label={`Remove ${val}`}
                  className="rounded hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(sel.filter((x) => x !== val))
                  }}
                >
                  <Cross2Icon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {/* Text input */}
            <input
              ref={inputRef}
              aria-label={ariaLabel}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
                setActiveIndex(0)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={sel.length ? '' : placeholder}
              autoComplete="off"
              className="flex-1 min-w-[6ch] bg-transparent outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>

          {/* Clear-all X icon */}
          <button
            type="button"
            title="Clear"
            aria-label="Clear"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-white/80 hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation()
              clearAll()
            }}
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
        </div>

        {/* Dropdown */}
        {open && options.length > 0 && (
          <div
            className={`absolute left-0 right-0 z-50 rounded-md border border-[color:var(--panel-border)] bg-[#0f172a]/95 text-sm text-white shadow-lg backdrop-blur-md ${
              placement === 'bottom' ? 'mt-1 top-full' : 'mb-1 bottom-full'
            }`}
            role="listbox"
            aria-label={ariaLabel}
          >
            <ul ref={listRef} className="overflow-y-auto py-1" style={{ maxHeight: panelMaxH }}>
              {options.map((opt, idx) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    data-idx={idx}
                    role="option"
                    aria-selected={idx === activeIndex}
                    className={`flex w-full items-center px-3 py-2 text-left hover:bg-white/10 focus:bg-white/10 ${
                      idx === activeIndex ? 'bg-white/10' : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()} // keep input focus
                    onClick={() => commitSelect(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ========================= Filter Menu =========================

type FilterMenuProps = {
  values: MapFilterValues
  onFieldChange: (field: MapFilterField, value: string) => void
  onReset: () => void
  onApply: () => void
  applyDisabled?: boolean
  airportSuggestions: FilterSuggestion[]
  countrySuggestions: FilterSuggestion[]
}

const splitCSV = (s?: string) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const joinCSV = (arr: string[]) => arr.join(', ')

export default function FilterMenu({
  values,
  onFieldChange,
  onReset,
  onApply,
  applyDisabled,
  airportSuggestions,
  countrySuggestions,
}: FilterMenuProps) {
  return (
    <div
      className="w-lg space-y-4 rounded-lg border bg-[#0f172a]/92 p-4 text-sm text-white shadow-lg backdrop-blur-md"
      style={{ borderColor: 'var(--panel-border)' }}
    >
      <div className="space-y-3">
        <span className="text-[0.8rem] uppercase text-[hsl(var(--muted-foreground))]">
          Departure
        </span>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Airport">
            <MultiSelectInput
              ariaLabel="Departure airports"
              placeholder="e.g. Cologne Bonn Airport (CGN/EDDK)"
              suggestions={airportSuggestions}
              selected={splitCSV(values.originAirport)}
              onChange={(arr) => onFieldChange('originAirport', joinCSV(arr))}
            />
          </Field>
          <Field label="Country/Countries">
            <MultiSelectInput
              ariaLabel="Departure countries"
              placeholder="e.g. Germany"
              suggestions={countrySuggestions}
              selected={splitCSV(values.originCountry)}
              onChange={(arr) => onFieldChange('originCountry', joinCSV(arr))}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-[0.8rem] uppercase text-[hsl(var(--muted-foreground))]">Arrival</span>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Airport">
            <MultiSelectInput
              ariaLabel="Destination airports"
              placeholder="e.g. JFK"
              suggestions={airportSuggestions}
              selected={splitCSV(values.destinationAirport)}
              onChange={(arr) => onFieldChange('destinationAirport', joinCSV(arr))}
            />
          </Field>
          <Field label="Country/Countries">
            <MultiSelectInput
              ariaLabel="Destination countries"
              placeholder="e.g. United States"
              suggestions={countrySuggestions}
              selected={splitCSV(values.destinationCountry)}
              onChange={(arr) => onFieldChange('destinationCountry', joinCSV(arr))}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="controls-btn rounded-md px-3 py-1.5 text-xs font-semibold uppercase"
          onClick={onReset}
        >
          Reset filters
        </button>
        <button
          type="button"
          className="controls-btn rounded-md px-3 py-1.5 text-xs font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onApply}
          disabled={applyDisabled}
        >
          Set filters
        </button>
      </div>
    </div>
  )
}
