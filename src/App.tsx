import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import FullscreenLayout from '@/app/components/FullscreenLayout'
import Header from '@/app/components/Header'
import MapPage from '@/app/routes/map/MapPage'

export default function App() {
  return (
    <BrowserRouter>
      <FullscreenLayout header={<Header />}>
        <Routes>
          <Route path="/" element={<MapPage />} />
        </Routes>
      </FullscreenLayout>
    </BrowserRouter>
  )
}
