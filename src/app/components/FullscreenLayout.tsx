import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function FullscreenLayout({ children }: Props) {
  return (
    <div id="app-root" className="h-full w-full flex flex-col">
      {/* relative, damit die Map gleich absolut hinein kann */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden">{children}</main>
    </div>
  )
}

export default FullscreenLayout
