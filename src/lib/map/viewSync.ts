export type ViewStateLite = {
  longitude: number
  latitude: number
  zoom: number
  bearing: number
  pitch: number
}

type Listener = (vs: ViewStateLite) => void

class ViewSyncStore {
  private state: ViewStateLite | null = null
  private listeners = new Set<Listener>()

  get() {
    if (this.state) return this.state
    try {
      const raw = localStorage.getItem('view-sync')
      if (raw) this.state = JSON.parse(raw)
    } catch (error) {
      console.warn('viewSync: unable to read persisted view state', error)
    }
    return this.state
  }

  set(vs: ViewStateLite) {
    this.state = { ...vs }
    try {
      localStorage.setItem('view-sync', JSON.stringify(this.state))
    } catch (error) {
      console.warn('viewSync: unable to persist view state', error)
    }
    for (const l of this.listeners) l(this.state)
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}

export const viewSync = new ViewSyncStore()
