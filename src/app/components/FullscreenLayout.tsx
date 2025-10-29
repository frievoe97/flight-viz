import { ReactNode } from 'react'

type Props = {
  header: ReactNode
  children: ReactNode
}

export function FullscreenLayout({ header, children }: Props) {
  return (
    <div className="min-h-dvh h-dvh w-dvw flex flex-col">
      <header
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        {header}
      </header>
      <main className="flex-1 min-h-0 min-w-0">{children}</main>
    </div>
  )
}

export default FullscreenLayout
