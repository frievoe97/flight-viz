import { useState } from 'react'
import './App.css'
import { cn } from './lib/utils'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-dvh w-full flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Vite + React + Tailwind</h1>
        <p className="text-muted-foreground">
          Tailwind v4, shadcn/ui utils, and Radix-ready setup.
        </p>
        <div className="space-x-2">
          <button
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
              'bg-primary text-primary-foreground shadow hover:opacity-90 h-10 px-4 py-2'
            )}
            onClick={() => setCount((c) => c + 1)}
          >
            Count is {count}
          </button>
          <a
            href="https://ui.shadcn.com" target="_blank" rel="noreferrer"
            className="underline underline-offset-4 text-sm"
          >
            shadcn/ui docs
          </a>
        </div>
      </div>
    </div>
  )
}

export default App
