import type { ReactNode } from 'react'

type Props = {
  header: ReactNode
  children: ReactNode
}

export function FullscreenLayout({ header, children }: Props) {
  return (
    <div id="app-root" className="h-full w-full flex flex-col">
      <header
        className="flex items-center justify-between border-b"
        style={{ backgroundColor: 'hsl(var(--panel))', borderColor: 'var(--panel-border)' }}
      >
        {header}
      </header>
      {/* relative, damit die Map gleich absolut hinein kann */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden">{children}</main>
    </div>
  )
}

export default FullscreenLayout
