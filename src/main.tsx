import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@deck.gl/core'
import { luma } from '@luma.gl/core'
import { webgl2Adapter } from '@luma.gl/webgl'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
// Force luma/deck to use the WebGL adapter. Firefox advertises WebGPU but lacks required limits
// which causes deck.gl to crash when it tries to create a WebGPU device.
try {
  ;(luma as unknown as { registerAdapters?: (adapters: unknown[]) => void; setDefaultDeviceProps?: (props: unknown) => void }).registerAdapters?.([
    webgl2Adapter,
  ])
  ;(luma as unknown as { registerAdapters?: (adapters: unknown[]) => void; setDefaultDeviceProps?: (props: unknown) => void }).setDefaultDeviceProps?.({
    type: 'webgl',
    adapters: [webgl2Adapter],
    waitForPageLoad: false,
  })
} catch (error) {
  console.warn('Unable to register luma WebGL adapter', error)
}
