import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import FullscreenLayout from '@/app/components/FullscreenLayout'
import MapPage from '@/app/routes/map/MapPage'
import StatsPage from '@/app/routes/stats/StatsPage'

export default function App() {
  return (
    <BrowserRouter>
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
