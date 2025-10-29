import { PageOverlaySelector } from './PageOverlaySelector'
import { Link } from 'react-router-dom'

export function Header() {
  return (
    <div className="w-full flex items-center justify-between gap-3">
      <Link to="/" className="text-sm font-semibold">
        Flight Viz
      </Link>
      <PageOverlaySelector />
    </div>
  )
}

export default Header
