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
        'w-full rounded-lg border px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] transition-colors',
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
}

export function FilterPopover({ label, value, options, onChange, disabled }: FilterPopoverProps) {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? null,
    [options, value]
  )
  const triggerLabel = selected ? `${selected.label} (${selected.count})` : 'No options'
  const isDisabled = disabled || options.length <= 1

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.6rem] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
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
            className="w-64 rounded-lg border border-[color:var(--panel-border)] bg-[#0f172a]/95 shadow-lg backdrop-blur-md"
          >
            <div className="max-h-64 overflow-y-auto p-2 text-sm text-white">
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
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {option.count}
                      </span>
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
