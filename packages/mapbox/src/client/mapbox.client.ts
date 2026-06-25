import { MapboxError } from "../errors";
import type { IMapboxClient } from "../interfaces/mapbox-client.interface";
import type { MapboxClientConfig, MapboxProfile } from "../types/common";
import type {
  DirectionsParams,
  DirectionsResponse,
} from "../types/directions";
import type {
  ForwardGeocodeParams,
  GeocodeFeature,
  GeocodeResponse,
  GeocodeResult,
  ReverseGeocodeParams,
} from "../types/geocoding";
import type {
  IsochroneParams,
  IsochroneResponse,
} from "../types/isochrone";
import type {
  MapMatchingParams,
  MapMatchingResponse,
} from "../types/map-matching";
import type { MatrixParams, MatrixResponse } from "../types/matrix";
import type {
  OptimizationParams,
  OptimizationResponse,
} from "../types/optimization";
import type {
  SearchBoxRetrieveParams,
  SearchBoxRetrieveResponse,
  SearchBoxSuggestParams,
  SearchBoxSuggestResponse,
} from "../types/search-box";
import type {
  StaticImageParams,
  TilequeryParams,
  TilequeryResponse,
} from "../types/static-images";

function formatCoordinates(coordinates: Array<[number, number]>): string {
  return coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
}

function toGeocodeResult(feature: GeocodeFeature): GeocodeResult {
  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    longitude,
    latitude,
    fullAddress: feature.properties.full_address ?? feature.properties.place_formatted,
    name: feature.properties.name,
    mapboxId: feature.properties.mapbox_id,
    raw: feature,
  };
}

export class MapboxClient implements IMapboxClient {
  private readonly accessToken: string;
  private readonly username: string;
  private readonly baseUrl: string;

  constructor(config: MapboxClientConfig) {
    this.accessToken = config.accessToken;
    this.username = config.username ?? "mapbox";
    this.baseUrl = (config.baseUrl ?? "https://api.mapbox.com").replace(/\/$/, "");
  }

  async forwardGeocode(params: ForwardGeocodeParams): Promise<GeocodeResult | null> {
    const response = await this.geocodeForwardRaw(params);
    const feature = response.features[0];
    return feature ? toGeocodeResult(feature) : null;
  }

  async reverseGeocode(params: ReverseGeocodeParams): Promise<GeocodeResult | null> {
    const response = await this.geocodeReverseRaw(params);
    const feature = response.features[0];
    return feature ? toGeocodeResult(feature) : null;
  }

  async geocodeForwardRaw(params: ForwardGeocodeParams): Promise<GeocodeResponse> {
    const { signal, query, ...queryParams } = params;
    return this.request<GeocodeResponse>("/search/geocode/v6/forward", {
      signal,
      query: {
        q: query,
        ...queryParams,
      },
    });
  }

  async geocodeReverseRaw(params: ReverseGeocodeParams): Promise<GeocodeResponse> {
    const { signal, longitude, latitude, ...queryParams } = params;
    return this.request<GeocodeResponse>("/search/geocode/v6/reverse", {
      signal,
      query: {
        longitude: String(longitude),
        latitude: String(latitude),
        ...queryParams,
      },
    });
  }

  async searchSuggest(params: SearchBoxSuggestParams): Promise<SearchBoxSuggestResponse> {
    const { signal, query, sessionToken, ...queryParams } = params;
    return this.request<SearchBoxSuggestResponse>("/search/searchbox/v1/suggest", {
      signal,
      query: {
        q: query,
        session_token: sessionToken,
        ...queryParams,
      },
    });
  }

  async searchRetrieve(params: SearchBoxRetrieveParams): Promise<SearchBoxRetrieveResponse> {
    const { signal, mapboxId, sessionToken } = params;
    return this.request<SearchBoxRetrieveResponse>(
      `/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}`,
      {
        signal,
        query: {
          session_token: sessionToken,
        },
      }
    );
  }

  async getDirections(params: DirectionsParams): Promise<DirectionsResponse> {
    const { signal, profile, coordinates, ...queryParams } = params;
    const path = `/directions/v5/${profile}/${formatCoordinates(coordinates)}`;
    return this.request<DirectionsResponse>(path, { signal, query: queryParams });
  }

  async getMatrix(params: MatrixParams): Promise<MatrixResponse> {
    const { signal, profile, coordinates, sources, destinations, ...queryParams } = params;
    const path = `/directions-matrix/v1/${profile}/${formatCoordinates(coordinates)}`;
    return this.request<MatrixResponse>(path, {
      signal,
      query: {
        ...queryParams,
        ...(sources !== undefined
          ? { sources: sources === "all" ? "all" : sources.join(";") }
          : {}),
        ...(destinations !== undefined
          ? { destinations: destinations === "all" ? "all" : destinations.join(";") }
          : {}),
      },
    });
  }

  async getIsochrone(params: IsochroneParams): Promise<IsochroneResponse> {
    const {
      signal,
      profile,
      longitude,
      latitude,
      contoursMinutes,
      contoursMeters,
      ...queryParams
    } = params;
    const path = `/isochrone/v1/${profile}/${longitude},${latitude}`;
    return this.request<IsochroneResponse>(path, {
      signal,
      query: {
        ...(contoursMinutes ? { contours_minutes: contoursMinutes.join(",") } : {}),
        ...(contoursMeters ? { contours_meters: contoursMeters.join(",") } : {}),
        ...queryParams,
      },
    });
  }

  async matchMap(params: MapMatchingParams): Promise<MapMatchingResponse> {
    const { signal, profile, coordinates, timestamps, radiuses, ...queryParams } = params;
    const path = `/matching/v5/${profile}/${formatCoordinates(coordinates)}`;
    return this.request<MapMatchingResponse>(path, {
      signal,
      query: {
        ...queryParams,
        ...(timestamps ? { timestamps: timestamps.join(";") } : {}),
        ...(radiuses ? { radiuses: radiuses.join(";") } : {}),
      },
    });
  }

  async optimizeTrip(params: OptimizationParams): Promise<OptimizationResponse> {
    const { signal, profile, coordinates, ...queryParams } = params;
    const path = `/optimized-trips/v1/${profile}/${formatCoordinates(coordinates)}`;
    return this.request<OptimizationResponse>(path, { signal, query: queryParams });
  }

  buildStaticImageUrl(params: StaticImageParams): string {
    const {
      styleId = "streets-v12",
      username = this.username,
      overlay,
      longitude,
      latitude,
      zoom = 14,
      width,
      height,
      bearing = 0,
      pitch = 0,
      retina = false,
    } = params;

    const size = `${width}x${height}${retina ? "@2x" : ""}`;
    const position = `${longitude},${latitude},${zoom},${bearing},${pitch}`;
    const overlaySegment = overlay ? `${overlay}/` : "";
    const path = `/styles/v1/${username}/${styleId}/static/${overlaySegment}${position}/${size}`;
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("access_token", this.accessToken);
    return url.toString();
  }

  async tilequery(params: TilequeryParams): Promise<TilequeryResponse> {
    const { signal, tilesetId, longitude, latitude, ...queryParams } = params;
    const path = `/v4/${tilesetId}/tilequery/${longitude},${latitude}.json`;
    return this.request<TilequeryResponse>(path, { signal, query: queryParams });
  }

  private async request<T>(
    path: string,
    options: {
      signal?: AbortSignal;
      query?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("access_token", this.accessToken);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined) {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method: "GET",
      signal: options.signal,
      headers: {
        Accept: "application/json",
      },
    });

    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      const message =
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof (body as { message: unknown }).message === "string"
          ? (body as { message: string }).message
          : `Mapbox request failed with status ${response.status}`;

      throw new MapboxError(message, response.status, body);
    }

    return body as T;
  }
}

export function createMapboxClient(config: MapboxClientConfig): MapboxClient {
  return new MapboxClient(config);
}

export function isMapboxProfile(value: string): value is MapboxProfile {
  return (
    value === "mapbox/driving" ||
    value === "mapbox/driving-traffic" ||
    value === "mapbox/walking" ||
    value === "mapbox/cycling"
  );
}
