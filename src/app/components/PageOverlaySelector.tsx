import * as Dialog from '@radix-ui/react-dialog'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const pages = [
  { path: '/', label: 'Dashboard' },
  { path: '/map', label: 'Map' },
  { path: '/flights', label: 'Flights' },
  { path: '/analytics', label: 'Analytics' },
]

export function PageOverlaySelector() {
  const location = useLocation()

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          Pages
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm rounded-lg border bg-[hsl(var(--background))] text-[hsl(var(--foreground))] p-4 shadow-lg"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          <Dialog.Title className="text-base font-semibold mb-3">Select a page</Dialog.Title>
          <div className="flex flex-col gap-2">
            {pages.map((p) => {
              const active = location.pathname === p.path
              return (
                <Dialog.Close asChild key={p.path}>
                  <Link
                    to={p.path}
                    className={cn(
                      'w-full inline-flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                      active
                        ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                        : 'hover:bg-[hsl(var(--muted))]'
                    )}
                    style={{ borderColor: 'hsl(var(--border))' }}
                  >
                    <span>{p.label}</span>
                    {active && <span className="text-xs">current</span>}
                  </Link>
                </Dialog.Close>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default PageOverlaySelector
