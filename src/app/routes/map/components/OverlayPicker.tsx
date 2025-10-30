import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { overlayOptions, type OverlayId } from '../overlays/options'

export function OverlayPicker({
  active,
  onSelect,
}: {
  active: OverlayId
  onSelect: (id: OverlayId) => void
}) {
  const current = overlayOptions.find((option) => option.id === active)

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="controls-btn rounded-md px-3 py-2 text-sm shadow">
          Overlay: {current?.label ?? 'Select'}
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
              return (
                <Popover.Close asChild key={option.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(option.id)}
                    className={cn(
                      'w-full text-left rounded-md border px-3 py-2 transition-colors',
                      activeVariant
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
