import type { CSSProperties, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

type CardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function Card({ title, subtitle, children, className, style }: CardProps) {
  return (
    <div
      className={cn(
        'card flex min-h-0 flex-col gap-3 rounded-xl border border-[color:var(--panel-border)] bg-[rgba(15,23,42,0.78)] p-4 text-white shadow-sm backdrop-blur',
        className
      )}
      style={style}
    >
      <header className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-white/90">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </div>
  )
}

export function ChartCard({ title, subtitle, children, className, style }: CardProps) {
  return (
    <Card title={title} subtitle={subtitle} className={cn('min-h-0', className)} style={style}>
      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function DetailCard({ title, subtitle, children, className, style }: CardProps) {
  return (
    <Card title={title} subtitle={subtitle} className={cn('min-h-0', className)} style={style}>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  )
}

export type { CardProps }
