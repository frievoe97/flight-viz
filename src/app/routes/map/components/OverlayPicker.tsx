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
        <button className="controls-btn rounded-md px-3 py-2 text-sm shadow">
          {current?.label ?? 'Select'}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          className="rounded-lg border w-64 bg-[#0f172a]/95 backdrop-blur-md shadow-lg ml-3 -mt-3"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <div className="flex flex-col gap-2 text-sm text-white p-3">
            {overlayOptions.map((option) => {
              const activeVariant = option.id === active
              const isDisabled = disabledSet.has(option.id)
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
                      'w-full text-left rounded-md border px-3 py-2 transition-colors',
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed border-[color:var(--panel-border)]'
                        : activeVariant
                          ? 'bg-[var(--panel-bg)]/90 text-white border-[color:var(--panel-border)]'
                          : 'hover:bg-white/10 border-[color:var(--panel-border)]'
                    )}
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
