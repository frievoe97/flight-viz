export type MapFilterValues = {
  startDate: string
  endDate: string
  originAirport: string
  originCountry: string
  destinationAirport: string
  destinationCountry: string
}

export type MapFilterField = keyof MapFilterValues

export type FilterSuggestion = {
  id: string
  value: string
  label: string
  searchKey: string
}

export const createDefaultMapFilters = (): MapFilterValues => ({
  startDate: '',
  endDate: '',
  originAirport: '',
  originCountry: '',
  destinationAirport: '',
  destinationCountry: '',
})
