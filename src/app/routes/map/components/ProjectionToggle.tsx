import { Globe2, Map as MapIcon } from 'lucide-react'

type ProjectionToggleProps = {
  projectionMode: 'globe' | 'mercator'
  onToggle: () => void
}

export function ProjectionToggle({ projectionMode, onToggle }: ProjectionToggleProps) {
  const isMercator = projectionMode === 'mercator'
  return (
    <button
      type="button"
      className="controls-btn rounded-full p-2 text-white [box-shadow:rgba(15,23,42,0.45)_0px_6px_18px]"
      style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
      onClick={onToggle}
      aria-label={
        isMercator ? 'Zur Globus-Projektion wechseln' : 'Zur Mercator-Projektion wechseln'
      }
      title={isMercator ? 'Switch to Globe projection' : 'Switch to Mercator projection'}
    >
      {isMercator ? (
        <Globe2 className="h-5 w-5" aria-hidden />
      ) : (
        <MapIcon className="h-5 w-5" aria-hidden />
      )}
    </button>
  )
}

export default ProjectionToggle
