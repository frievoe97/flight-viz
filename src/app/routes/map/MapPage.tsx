import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import { useNavigate } from 'react-router-dom'
import { MAP_STYLES } from '@/lib/map/deckConfig'
import MapSettings from './components/MapSettings'
import ProjectionToggle from './components/ProjectionToggle'
import LocationSearch, { type LocationSearchHandle } from './components/LocationSearch'
import ThemeToggle from '@/app/components/ThemeToggle'
import { useTheme } from '@/lib/theme/useTheme'
import StatsShortcut from './components/StatsShortcut'
import FlightDetailsPanel from './components/FlightDetailsPanel'
import FilterMenu from './components/FilterMenu'
import { useMapPageState, MAP_PADDING } from './hooks/useMapPageState'
import { createDefaultMapFilters, type MapFilterField, type MapFilterValues } from './types'
import { Filter, RotateCcw } from 'lucide-react'

export default function MapPage() {
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchHighlight, setSearchHighlight] = useState<{ position: [number, number] } | null>(
    null
  )
  const controlPanelRef = useRef<HTMLDivElement | null>(null)
  const filterPanelRef = useRef<HTMLDivElement | null>(null)
  const locationSearchRef = useRef<LocationSearchHandle | null>(null)
  // Theme awareness for map style
  const { theme } = useTheme()

  const {
    data,
    mapRef,
    projectionMode,
    activeOverlay,
    isFlights,
    isTrails,
    isSegments,
    isAnalytics,
    isRoutes,
    isAirports,
    isSpeedColumns,
    isClimbBursts,
    isMotionPaused,
    settingsOpen,
    layersOpen,
    toggleSettingsPanel,
    toggleLayersPanel,
    handleOverlaySelect,
    handleMapLoad,
    handleMapMove,
    toggleProjection,
    // toggleAnalyticsMetric,
    setAnalyticsMetric,
    analyticsMetric,
    flightSpeedMultiplier,
    setFlightSpeedMultiplier,
    planeSizeScale,
    setPlaneSizeScale,
    trailSpeedMultiplier,
    setTrailSpeedMultiplier,
    trailLengthSeconds,
    setTrailLengthSeconds,
    trailWidthScale,
    setTrailWidthScale,
    trailOpacity,
    setTrailOpacity,
    segmentWidthScale,
    setSegmentWidthScale,
    routeWidthScale,
    setRouteWidthScale,
    routeHeight,
    setRouteHeight,
    routeOpacity,
    setRouteOpacity,
    airportSizeScale,
    setAirportSizeScale,
    airportOpacity,
    setAirportOpacity,
    analyticsRadius,
    setAnalyticsRadius,
    analyticsElevationScale,
    setAnalyticsElevationScale,
    analyticsOpacity,
    setAnalyticsOpacity,
    selectedFlight,
    chartData,
    clearSelectedFlight,
    formatKm,
    formatFt,
    formatDuration,
    resetView,
    focusOnLocation,
    closeControlPanels,
    toggleMotionPaused,
    mapFilters,
    applyMapFilters,
    resetMapFilters,
    airportSuggestions,
    countrySuggestions,
    hasActiveFilters,
  } = useMapPageState({ theme })

  const [pendingFilters, setPendingFilters] = useState<MapFilterValues>(mapFilters)

  useEffect(() => {
    setPendingFilters(mapFilters)
  }, [mapFilters])

  const handlePendingFilterChange = useCallback((field: MapFilterField, value: string) => {
    setPendingFilters((prev) => {
      if (prev[field] === value) return prev
      return { ...prev, [field]: value }
    })
  }, [])

  const shouldResetAfterFilterChangeRef = useRef(false)

  const handleFilterApply = useCallback(() => {
    applyMapFilters(pendingFilters)
    shouldResetAfterFilterChangeRef.current = true
    setFiltersOpen(false)
  }, [applyMapFilters, pendingFilters])

  const handleFilterReset = useCallback(() => {
    const defaults = createDefaultMapFilters()
    const isAlreadyDefault = (Object.keys(defaults) as MapFilterField[]).every(
      (field) => mapFilters[field] === defaults[field]
    )
    resetMapFilters()
    setPendingFilters(defaults)
    setFiltersOpen(false)
    if (isAlreadyDefault) {
      resetView()
    } else {
      shouldResetAfterFilterChangeRef.current = true
    }
  }, [mapFilters, resetMapFilters, resetView])

  const hasPendingChanges = useMemo(() => {
    return (Object.keys(mapFilters) as MapFilterField[]).some(
      (field) => mapFilters[field] !== pendingFilters[field]
    )
  }, [mapFilters, pendingFilters])

  const handleLocationSelect = useCallback(
    ({
      position,
      zoom,
      bounds,
    }: {
      position: [number, number]
      zoom?: number
      bounds?: [number, number, number, number]
    }) => {
      focusOnLocation(position, { zoom, bounds })
      setSearchHighlight({ position })
    },
    [focusOnLocation]
  )

  useEffect(() => {
    if (shouldResetAfterFilterChangeRef.current) {
      shouldResetAfterFilterChangeRef.current = false
      resetView()
    }
  }, [mapFilters, resetView])

  useEffect(() => {
    if (!searchHighlight) return
    const timeout = window.setTimeout(() => setSearchHighlight(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [searchHighlight])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      const target = event.target as HTMLElement | null
      const isEditable =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isEditable && key !== 'escape') {
        return
      }
      switch (key) {
        case 's': {
          event.preventDefault()
          locationSearchRef.current?.open()
          break
        }
        case 'p': {
          event.preventDefault()
          toggleProjection()
          break
        }
        case 'f': {
          event.preventDefault()
          setFiltersOpen((prev) => !prev)
          break
        }
        case 'r': {
          event.preventDefault()
          resetView()
          break
        }
        case 'escape': {
          let handled = false
          if (filtersOpen) {
            setFiltersOpen(false)
            handled = true
          }
          if (settingsOpen || layersOpen) {
            closeControlPanels()
            handled = true
          }
          if (locationSearchRef.current?.isOpen?.()) {
            locationSearchRef.current.close()
            handled = true
          }
          if (handled) event.preventDefault()
          break
        }
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [
    toggleProjection,
    resetView,
    setFiltersOpen,
    filtersOpen,
    settingsOpen,
    layersOpen,
    closeControlPanels,
  ])

  useEffect(() => {
    if (!settingsOpen && !layersOpen && !filtersOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      const isInsideControls = controlPanelRef.current?.contains(target)
      const isInsideFilters = filterPanelRef.current?.contains(target)
      const isInsideControlPortal =
        target instanceof Element && !!target.closest('[data-map-portal="controls"]')

      if ((settingsOpen || layersOpen) && !isInsideControls && !isInsideControlPortal) {
        closeControlPanels()
      }

      if (filtersOpen && !isInsideFilters) {
        setFiltersOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [layersOpen, settingsOpen, filtersOpen, closeControlPanels])

  useEffect(() => {
    const nativeMap = mapRef.current?.getMap?.()
    if (!nativeMap) return
    if (typeof nativeMap.setSky !== 'function') return

    const isGlobe = projectionMode === 'globe'
    const spaceColor = theme === 'light' ? '#0f172a' : '#01030b'
    const haloColor = theme === 'light' ? '#bae6fd' : '#1f2937'
    const atmosphereColor = theme === 'light' ? '#bfdbfe' : '#0b1f3a'

    nativeMap.setSky({
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-color': atmosphereColor,
        'sky-atmosphere-halo-color': haloColor,
        'sky-atmosphere-sun': [1.5, 90],
        'sky-atmosphere-sun-intensity': isGlobe ? 12 : 0,
        'sky-color': spaceColor,
        'sky-opacity': isGlobe ? 1 : 0,
      },
    } as maplibregl.SkyLayerSpecification)

    if (typeof nativeMap.setLight === 'function') {
      nativeMap.setLight({
        anchor: 'map',
        position: [1.5, 90, 80],
        intensity: isGlobe ? 0.7 : 0.2,
        color: theme === 'light' ? '#fff7ed' : '#f8fafc',
      })
    }
  }, [projectionMode, theme, mapRef])

  if (!data) return <div className="h-full w-full" />

  const gridTemplateRows =
    selectedFlight && chartData && isSegments ? '1fr minmax(12rem, 16rem)' : '1fr'

  return (
    <div className="h-full w-full grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows }}>
      <div className="relative" style={{ backgroundColor: 'var(--map-land)' }}>
        <MapGL
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={theme === 'light' ? MAP_STYLES.light : MAP_STYLES.dark}
          attributionControl={false}
          projection={projectionMode}
          maxPitch={projectionMode === 'globe' ? 0 : 85}
          dragRotate={projectionMode !== 'globe'}
          touchPitch={projectionMode !== 'globe'}
          initialViewState={{
            latitude: data.INITIAL_VIEW_STATE.latitude,
            longitude: data.INITIAL_VIEW_STATE.longitude,
            zoom: data.INITIAL_VIEW_STATE.zoom ?? 1,
            bearing: data.INITIAL_VIEW_STATE.bearing,
            pitch: data.INITIAL_VIEW_STATE.pitch,
            padding: MAP_PADDING,
          }}
          onLoad={handleMapLoad}
          onMove={({ viewState }) => handleMapMove(viewState)}
          style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
        >
          <NavigationControl
            key={projectionMode}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid var(--panel-border)',
              boxShadow: '0 6px 18px rgba(15, 23, 42, 0.45)',
            }}
            showCompass={projectionMode !== 'globe'}
            showZoom
            visualizePitch={projectionMode !== 'globe'}
          />
          {searchHighlight ? (
            <Marker
              longitude={searchHighlight.position[0]}
              latitude={searchHighlight.position[1]}
              anchor="center"
            >
              <span className="relative block h-10 w-10" style={{ pointerEvents: 'none' }}>
                <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 opacity-75 animate-ping" />
                <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/30 blur-[1px]" />
                <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--flight-speed)] shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
              </span>
            </Marker>
          ) : null}
        </MapGL>

        <div className="absolute top-3 left-3 z-10 flex items-start gap-2">
          <ProjectionToggle projectionMode={projectionMode} onToggle={toggleProjection} />
          <LocationSearch ref={locationSearchRef} onSelect={handleLocationSelect} />
          <ThemeToggle />
        </div>

        <div
          className="absolute right-3 z-10"
          style={{ top: projectionMode === 'globe' ? '5.3rem' : 'calc(5.3rem + 29px)' }}
        >
          <button
            type="button"
            className="controls-btn flex items-center gap-2 rounded-full px-2 py-2 text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--controls-shadow)' }}
            onClick={resetView}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div
          ref={filterPanelRef}
          className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2"
        >
          {filtersOpen ? (
            <FilterMenu
              values={pendingFilters}
              airportSuggestions={airportSuggestions}
              countrySuggestions={countrySuggestions}
              onFieldChange={handlePendingFilterChange}
              onReset={handleFilterReset}
              onApply={handleFilterApply}
              applyDisabled={!hasPendingChanges}
            />
          ) : null}

          <div className="flex items-center gap-2">
            <StatsShortcut onClick={() => navigate('/stats')} />
            <button
              type="button"
            className="controls-btn rounded-full p-2"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--controls-shadow)' }}
            onClick={() => setFiltersOpen((prev) => !prev)}
            aria-expanded={filtersOpen}
            aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
            title="Filters"
          >
              <Filter
                className="h-5 w-5"
                aria-hidden
                style={hasActiveFilters ? { color: 'var(--flight-speed)' } : undefined}
              />
            </button>
          </div>
        </div>

        <div ref={controlPanelRef} className="absolute bottom-3 right-3 z-10">
          <MapSettings
            settingsOpen={settingsOpen}
            layersOpen={layersOpen}
            onToggleSettings={toggleSettingsPanel}
            onToggleLayers={toggleLayersPanel}
            activeOverlay={activeOverlay}
            onOverlaySelect={handleOverlaySelect}
            isFlights={isFlights}
            isTrails={isTrails}
            isSegments={isSegments}
            isAnalytics={isAnalytics}
            isRoutes={isRoutes}
            isAirports={isAirports}
            isSpeedColumns={isSpeedColumns}
            isClimbBursts={isClimbBursts}
            isMotionPaused={isMotionPaused}
            flightSpeedMultiplier={flightSpeedMultiplier}
            onFlightSpeedChange={(value) => setFlightSpeedMultiplier(value)}
            planeSizeScale={planeSizeScale}
            onPlaneSizeChange={(value) => setPlaneSizeScale(value)}
            trailSpeedMultiplier={trailSpeedMultiplier}
            onTrailSpeedChange={(value) => setTrailSpeedMultiplier(value)}
            trailLengthSeconds={trailLengthSeconds}
            onTrailLengthChange={(value) => setTrailLengthSeconds(value)}
            trailWidthScale={trailWidthScale}
            onTrailWidthChange={(value) => setTrailWidthScale(value)}
            trailOpacity={trailOpacity}
            onTrailOpacityChange={(value) => setTrailOpacity(value)}
            segmentWidthScale={segmentWidthScale}
            onSegmentWidthChange={(value) => setSegmentWidthScale(value)}
            routeWidthScale={routeWidthScale}
            onRouteWidthChange={(value) => setRouteWidthScale(value)}
            routeHeight={routeHeight}
            onRouteHeightChange={(value) => setRouteHeight(value)}
            routeOpacity={routeOpacity}
            onRouteOpacityChange={(value) => setRouteOpacity(value)}
            airportSizeScale={airportSizeScale}
            onAirportSizeChange={(value) => setAirportSizeScale(value)}
            airportOpacity={airportOpacity}
            onAirportOpacityChange={(value) => setAirportOpacity(value)}
            analyticsRadius={analyticsRadius}
            onAnalyticsRadiusChange={(value) => setAnalyticsRadius(value)}
            analyticsElevationScale={analyticsElevationScale}
            onAnalyticsElevationScaleChange={(value) => setAnalyticsElevationScale(value)}
            analyticsOpacity={analyticsOpacity}
            onAnalyticsOpacityChange={(value) => setAnalyticsOpacity(value)}
            analyticsMetric={analyticsMetric}
            onAnalyticsMetricChange={(m) => setAnalyticsMetric(m)}
            onToggleMotionPaused={toggleMotionPaused}
          />
        </div>
      </div>

      {isSegments && selectedFlight && chartData ? (
        <FlightDetailsPanel
          flight={selectedFlight}
          chartData={chartData}
          formatKm={formatKm}
          formatFt={formatFt}
          formatDuration={formatDuration}
          onClear={clearSelectedFlight}
        />
      ) : null}
    </div>
  )
}
