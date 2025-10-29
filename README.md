# Flight Viz – React + Tailwind + DeckGL

Ein Dashboard zur Visualisierung von Flugdaten mit React, Tailwind CSS, DeckGL und MapLibre. Enthält ein Vollbild-Layout, Seiten-Routing, eine Kartenansicht (2D) und ein Overlay zum Seitenwechsel.

## Inhalt
- Projektbeschreibung
- Technologie-Stack
- Setup & Installation
- Projektstruktur
- Styling & Theme
- Datenzugriff
- Entwicklungsrichtlinien
- Deployment

## Projektbeschreibung
Flight Viz zeigt mehrere Seiten (Dashboard, Map, Flights, Analytics). Die Map-Seite rendert Flugrouten mit DeckGL über einer MapLibre-Basiskarte und stellt Statistiken sowie ein Liniendiagramm zur Verfügung.

## Technologie-Stack
- React + TypeScript + Vite
- Tailwind CSS (v4) mit CSS-Variablen
- React Router
- DeckGL + MapLibre (Basemap: CARTO Dark Matter, 2D)
- ESLint + Prettier

## Setup & Installation
```
git clone <REPO_URL>
cd flight_viz
npm install
npm run dev
```

## Projektstruktur
```
src/
  app/
    components/      # Header, FullscreenLayout, Overlay, etc.
    routes/          # Seiten (dashboard, map, flights, analytics)
    styles/          # Theme-Variablen, globale Styles
  data/              # Loader, Raw-Daten (src/data/raw)
  lib/               # Utilitys (map config, helpers)
  assets/            # Bilder/Icons (optional)
  App.tsx            # Router + Layout
  main.tsx           # Einstiegspunkt
```

## Styling & Theme
- Zentrale Design-Tokens unter `src/app/styles/theme.css` als CSS-Variablen:
  - `--map-water`, `--map-land`, `--panel-border`, `--panel-bg`, `--chart-axis`, `--flight-*`
- Tailwind-Klassen nutzen diese Variablen via Arbitrary Values oder thematische Utilities:
  - Klassen `.panel`, `.card`, `.controls-btn` kapseln häufige UI-Muster und Farben.
- Dark-Mode ist über `.dark`-Klasse erweiterbar.

## Datenzugriff
- Statische Flugdaten werden aus `src/data/raw/**` geladen (GeoJSON + optionale `.meta.json`).
- Zentraler Loader: `src/data/index.ts` – liefert `flights`, `flightSegments`, `aggregatedStats`, `INITIAL_VIEW_STATE`.

Beispiel:
```ts
import { getFlightData } from '@/data'
const { flights } = await getFlightData()
```

## Entwicklungsrichtlinien
- ESLint + Prettier: `npm run lint`, `npm run format`
- Komponenten klein und modular halten; keine Inline-Stile (Ausnahmen: Map)
- Commit-Nachrichten nach Conventional Commits

## Deployment
```
npm run build
```
Das Build liegt in `dist/` und kann als statische Seite bereitgestellt werden.
