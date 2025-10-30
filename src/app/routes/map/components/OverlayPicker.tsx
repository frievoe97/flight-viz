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
        <Popover.Content className="rounded-lg border bg-[hsl(var(--background))] p-3 shadow-lg w-64">
          <div className="flex flex-col gap-2 text-sm">
            {overlayOptions.map((option) => {
              const activeVariant = option.id === active
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => onSelect(option.id)}
                  className={cn(
                    'w-full text-left rounded-md border px-3 py-2 transition-colors',
                    activeVariant
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                      : 'hover:bg-[hsl(var(--muted))]'
                  )}
                  style={{ borderColor: 'hsl(var(--border))' }}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {option.description}
                  </div>
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default OverlayPicker

