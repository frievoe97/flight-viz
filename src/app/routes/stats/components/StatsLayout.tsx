import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StatsLayoutProps = {
  sidebar?: ReactNode
  children: ReactNode
  className?: string
}

export function StatsLayout({ sidebar, children, className }: StatsLayoutProps) {
  return (
    <div
      className={cn('flex h-full w-full', className)}
      style={{ backgroundColor: 'var(--map-land)', color: 'var(--controls-fg)' }}
    >
      <div className={cn('flex h-full w-full', sidebar ? 'flex-col md:flex-row' : 'flex-col')}>
        {sidebar ? sidebar : null}
        <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </section>
      </div>
    </div>
  )
}

export type { StatsLayoutProps }
