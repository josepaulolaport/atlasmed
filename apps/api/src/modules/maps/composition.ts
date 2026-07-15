import { MapboxNotConfiguredError } from '@atlasmed/mapbox'
import {
  getMapboxClient,
  isMapboxConfigured
} from '../../infrastructure/external-services/mapbox/mapbox.client'
import type { GeocodingPort } from './application/interfaces/geocoding.port'
import { MapboxMapsUseCases } from './application/use-cases/mapbox-maps.use-cases'
import { MapboxGeocodingAdapter } from './infrastructure/adapters/mapbox-geocoding.adapter'

class NoopGeocodingAdapter implements GeocodingPort {
  async forwardGeocode() {
    return null
  }

  async reverseGeocode() {
    return null
  }
}

function createGeocodingPort(): GeocodingPort {
  if (!isMapboxConfigured()) {
    return new NoopGeocodingAdapter()
  }

  return new MapboxGeocodingAdapter(getMapboxClient())
}

export const geocodingPort = createGeocodingPort()

export const mapboxMapsUseCases = new MapboxMapsUseCases({
  getClient: () => getMapboxClient(),
  isConfigured: isMapboxConfigured
})

export { isMapboxConfigured, MapboxNotConfiguredError }
