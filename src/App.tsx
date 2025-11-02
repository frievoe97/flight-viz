// App.tsx
import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import FullscreenLayout from '@/app/components/FullscreenLayout'
import MapPage from '@/app/routes/map/MapPage'
import StatsPage from '@/app/routes/stats/StatsPage'

const basename = import.meta.env.PROD ? '/flight-viz' : '/'

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <FullscreenLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </FullscreenLayout>
    </BrowserRouter>
  )
}
