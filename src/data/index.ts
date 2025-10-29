// Central data loader API (stub)
// Intentionally minimal to allow swapping to an API later

export type FlightRecord = {
  id: string
  // extend with properties later
}

export async function loadFlights(): Promise<FlightRecord[]> {
  // TODO: replace with real loader
  return []
}

export default {
  loadFlights,
}
