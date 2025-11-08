import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null
  if (saved === 'light' || saved === 'dark') return saved
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

type ThemeContextValue = { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void }

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyThemeToDom(theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }, [theme])

  // Optional: sync between tabs and late consumers
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue as Theme)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')) }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (ctx) return ctx
  // Fallback (if used outside provider): apply directly but not shared
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  useEffect(() => applyThemeToDom(theme), [theme])
  return { theme, setTheme, toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')) }
}
