import { Link } from 'react-router-dom'

export function Header() {
  return (
    <div className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <Link
        to="/"
        className="font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]"
      >
        Flight Viz
      </Link>
    </div>
  )
}

export default Header
