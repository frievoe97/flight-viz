import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme/useTheme'

type Props = {
  className?: string
}

export default function ThemeToggle({ className }: Props) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className={`controls-btn rounded-full p-2 ${className ?? ''}`}
      style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--controls-shadow)' }}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  )
}
