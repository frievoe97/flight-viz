import { useMemo } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import type { FilterOption, StatsPageView } from '../hooks/useStatsPageState'

type SidebarButtonProps = {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}

export function SidebarButton({ active, children, onClick }: SidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'w-full rounded-lg border px-3 py-2 text-center text-xs font-semibold uppercase transition-colors',
        active
          ? 'bg-[rgba(15,23,42,0.78)] text-white border-[color:var(--panel-border)] shadow'
          : 'text-[hsl(var(--muted-foreground))] border-transparent hover:bg-white/5'
      )}
      style={{ borderColor: active ? 'var(--panel-border)' : 'transparent' }}
    >
      {children}
    </button>
  )
}

type FilterPopoverProps = {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  disabled?: boolean
  showCount?: boolean
}

export function FilterPopover({
  label,
  value,
  options,
  onChange,
  disabled,
  showCount = true,
}: FilterPopoverProps) {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? null,
    [options, value]
  )
  const triggerLabel = selected
    ? showCount && typeof selected.count === 'number'
      ? `${selected.label} (${selected.count})`
      : selected.label
    : 'No options'
  const isDisabled = disabled || options.length <= 1

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.6rem] uppercase  text-[hsl(var(--muted-foreground))]">{label}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={isDisabled}
            className={cn(
              'controls-btn flex items-center justify-between rounded-md px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[rgba(56,189,248,0.45)]',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderColor: 'var(--panel-border)' }}
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <span aria-hidden className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
              ▼
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={8}
            avoidCollisions
            collisionPadding={8}
            sticky="partial"
            className="w-fit min-w-64 rounded-lg border border-[color:var(--panel-border)] bg-[#0f172a]/95 shadow-lg backdrop-blur-md
             max-h-[min(70vh,16rem)] overflow-auto"
          >
            <div className="p-2 text-sm text-white">
              {options.map((option) => {
                const isActive = option.value === value
                return (
                  <Popover.Close asChild key={option.value}>
                    <button
                      type="button"
                      onClick={() => onChange(option.value)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors',
                        isActive ? 'bg-white/10' : 'hover:bg-white/10'
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {showCount ? (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {option.count}
                        </span>
                      ) : null}
                    </button>
                  </Popover.Close>
                )
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

export type { StatsPageView }

type FlightFilterSelectProps = {
  label?: string
  options: Array<{ id: string; label: string }>
  selectedId: string | null
  selectedLabel: string
  onSelect: (id: string) => void
}

export function FlightFilterSelect({
  label = 'Flight',
  options,
  selectedId,
  selectedLabel,
  onSelect,
}: FlightFilterSelectProps) {
  const hasOptions = options.length > 0
  const triggerLabel = hasOptions ? selectedLabel : 'No flights available'

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.6rem] uppercase  text-[hsl(var(--muted-foreground))]">{label}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={!hasOptions}
            className={cn(
              'controls-btn flex items-center justify-between rounded-md px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[rgba(56,189,248,0.45)]',
              !hasOptions && 'opacity-50 cursor-not-allowed'
            )}
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderColor: 'var(--panel-border)' }}
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <span aria-hidden className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
              ▼
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={8}
            avoidCollisions
            collisionPadding={8}
            sticky="partial"
            className="w-64 rounded-lg border border-[color:var(--panel-border)] bg-[#0f172a]/95 shadow-lg backdrop-blur-md
             max-h-[min(70vh,16rem)] overflow-auto"
          >
            <div className="p-2 text-sm text-white">
              {options.length ? (
                options.map((option) => {
                  const isActive = option.id === selectedId
                  return (
                    <Popover.Close asChild key={option.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(option.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors',
                          isActive ? 'bg-white/10' : 'hover:bg-white/10'
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                      </button>
                    </Popover.Close>
                  )
                })
              ) : (
                <div className="px-3 py-2 text-xs text-white/50">No flights available</div>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
