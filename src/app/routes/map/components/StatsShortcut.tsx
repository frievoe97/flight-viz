import { PieChart } from 'lucide-react'

type StatsShortcutProps = {
  onClick: () => void
}

export function StatsShortcut({ onClick }: StatsShortcutProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="controls-btn rounded-full p-2 text-white [box-shadow:rgba(15,23,42,0.45)_0px_6px_18px]"
      style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
      aria-label="Statistiken öffnen"
      title="Statistiken"
    >
      <PieChart className="h-5 w-5 scale-110" aria-hidden />
    </button>
  )
}

export default StatsShortcut
