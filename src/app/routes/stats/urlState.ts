import type { StatsPageView } from './hooks/useStatsPageState'

export type StatsUrlState = {
  activeView?: StatsPageView
  searchTerm?: string
  filterDate?: string
  filterOrigin?: string
  filterDestination?: string
  filterOriginCountry?: string
  filterDestinationCountry?: string
  selectedFlightId?: string | null
  ignoreSameStartTarget?: boolean
}

const STAT_KEYS = {
  view: 'stats_view',
  search: 'stats_search',
  date: 'stats_filter_date',
  origin: 'stats_filter_origin',
  destination: 'stats_filter_destination',
  originCountry: 'stats_filter_originCountry',
  destinationCountry: 'stats_filter_destinationCountry',
  selectedFlight: 'stats_selectedFlight',
  ignoreSame: 'stats_ignoreSame',
} as const

const normalizeFilterValue = (value: string | null) => (value && value !== 'all' ? value : 'all')

export function parseStatsUrlState(params: URLSearchParams): StatsUrlState {
  return {
    activeView: params.get(STAT_KEYS.view) === 'flight' ? 'flight' : 'overview',
    searchTerm: params.get(STAT_KEYS.search) ?? '',
    filterDate: normalizeFilterValue(params.get(STAT_KEYS.date)),
    filterOrigin: normalizeFilterValue(params.get(STAT_KEYS.origin)),
    filterDestination: normalizeFilterValue(params.get(STAT_KEYS.destination)),
    filterOriginCountry: normalizeFilterValue(params.get(STAT_KEYS.originCountry)),
    filterDestinationCountry: normalizeFilterValue(params.get(STAT_KEYS.destinationCountry)),
    selectedFlightId: params.get(STAT_KEYS.selectedFlight),
    ignoreSameStartTarget: params.get(STAT_KEYS.ignoreSame) !== '0',
  }
}

export function buildStatsUrlParams(state: StatsUrlState): Record<string, string | null | undefined> {
  return {
    [STAT_KEYS.view]: state.activeView ?? 'overview',
    [STAT_KEYS.search]: state.searchTerm ?? '',
    [STAT_KEYS.date]: state.filterDate && state.filterDate !== 'all' ? state.filterDate : null,
    [STAT_KEYS.origin]:
      state.filterOrigin && state.filterOrigin !== 'all' ? state.filterOrigin : null,
    [STAT_KEYS.destination]:
      state.filterDestination && state.filterDestination !== 'all' ? state.filterDestination : null,
    [STAT_KEYS.originCountry]:
      state.filterOriginCountry && state.filterOriginCountry !== 'all'
        ? state.filterOriginCountry
        : null,
    [STAT_KEYS.destinationCountry]:
      state.filterDestinationCountry && state.filterDestinationCountry !== 'all'
        ? state.filterDestinationCountry
        : null,
    [STAT_KEYS.selectedFlight]: state.selectedFlightId ?? null,
    [STAT_KEYS.ignoreSame]: state.ignoreSameStartTarget ? null : '0',
  }
}
