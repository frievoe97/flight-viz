import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FullscreenLayout from '@/app/components/FullscreenLayout'
import Header from '@/app/components/Header'
import DashboardPage from '@/app/routes/dashboard/DashboardPage'
import MapPage from '@/app/routes/map/MapPage'
import FlightsPage from '@/app/routes/flights/FlightsPage'
import AnalyticsPage from '@/app/routes/analytics/AnalyticsPage'

export default function App() {
  return (
    <BrowserRouter>
      <FullscreenLayout header={<Header />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/flights" element={<FlightsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </FullscreenLayout>
    </BrowserRouter>
  )
}
