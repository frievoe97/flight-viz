import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { overlayOptions, type OverlayId } from '../overlays/options'

export function OverlayPicker({
  active,
  onSelect,
  disabledOptions = [],
}: {
  active: OverlayId
  onSelect: (id: OverlayId) => void
  disabledOptions?: OverlayId[]
}) {
  const current = overlayOptions.find((option) => option.id === active)
  const disabledSet = new Set(disabledOptions)

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="controls-btn flex w-full items-center justify-between rounded-md px-3 py-2 text-sm shadow transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[rgba(56,189,248,0.45)]">
          <span className="truncate text-left">
            {current?.label ?? 'Overlay wählen'}
          </span>
          <span aria-hidden className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
            ▼
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          data-map-portal="controls"
          side="top"
          align="end"
          sideOffset={8}
          className="w-64 rounded-lg border bg-[#0f172a]/95 p-3 text-sm text-white shadow-lg backdrop-blur-md"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <div className="flex flex-col gap-2">
            {overlayOptions.map((option) => {
              const isDisabled = disabledSet.has(option.id)
              const isActive = option.id === active
              return (
                <Popover.Close asChild key={option.id}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) onSelect(option.id)
                    }}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition',
                      isDisabled
                        ? 'cursor-not-allowed opacity-50'
                        : isActive
                          ? 'bg-[var(--panel-bg)]/90 text-white'
                          : 'hover:bg-white/10'
                    )}
                    style={{ borderColor: 'var(--panel-border)' }}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {option.description}
                    </div>
                  </button>
                </Popover.Close>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default OverlayPicker
