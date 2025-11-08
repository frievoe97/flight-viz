import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FilterSuggestion, MapFilterField, MapFilterValues } from '../types'

type FilterMenuProps = {
  values: MapFilterValues
  onFieldChange: (field: MapFilterField, value: string) => void
  onReset: () => void
  airportSuggestions: FilterSuggestion[]
  countrySuggestions: FilterSuggestion[]
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))]">
      <span>{label}</span>
      {children}
    </label>
  )
}

const inputClassName =
  'w-full rounded-md border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.6)] px-3 py-2 text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[rgba(56,189,248,0.45)]'

type SuggestionInputProps = {
  value: string
  placeholder: string
  suggestions: FilterSuggestion[]
  onChange: (value: string) => void
}

function SuggestionInput({ value, placeholder, suggestions, onChange }: SuggestionInputProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const filteredSuggestions = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return suggestions.slice(0, 8)
    return suggestions.filter((item) => item.searchKey.includes(query)).slice(0, 8)
  }, [value, suggestions])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const handleSelect = (text: string) => {
    onChange(text)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
      />
      {open && filteredSuggestions.length ? (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-[color:var(--panel-border)] bg-[#0f172a]/95 text-sm text-white shadow-lg backdrop-blur-md">
          <ul className="max-h-56 overflow-y-auto py-1">
            {filteredSuggestions.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-left hover:bg-white/10"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default function FilterMenu({
  values,
  onFieldChange,
  onReset,
  airportSuggestions,
  countrySuggestions,
}: FilterMenuProps) {
  return (
    <div
      className="w-72 space-y-4 rounded-lg border bg-[#0f172a]/92 p-4 text-sm text-white shadow-lg backdrop-blur-md"
      style={{ borderColor: 'var(--panel-border)' }}
    >
      <div className="space-y-3">
        <span className="text-[0.6rem] uppercase tracking-[0.4em] text-[hsl(var(--muted-foreground))]">
          Departure
        </span>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Airport">
            <SuggestionInput
              value={values.originAirport}
              placeholder="e.g. Cologne Bonn Airport (CGN/EDDK)"
              suggestions={airportSuggestions}
              onChange={(text) => onFieldChange('originAirport', text)}
            />
          </Field>
          <Field label="Country">
            <SuggestionInput
              value={values.originCountry}
              placeholder="e.g. Germany"
              suggestions={countrySuggestions}
              onChange={(text) => onFieldChange('originCountry', text)}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-[0.6rem] uppercase tracking-[0.4em] text-[hsl(var(--muted-foreground))]">
          Arrival
        </span>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Airport">
            <SuggestionInput
              value={values.destinationAirport}
              placeholder="e.g. JFK"
              suggestions={airportSuggestions}
              onChange={(text) => onFieldChange('destinationAirport', text)}
            />
          </Field>
          <Field label="Country">
            <SuggestionInput
              value={values.destinationCountry}
              placeholder="e.g. United States"
              suggestions={countrySuggestions}
              onChange={(text) => onFieldChange('destinationCountry', text)}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="controls-btn rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em]"
          onClick={onReset}
        >
          Reset filters
        </button>
      </div>
    </div>
  )
}
