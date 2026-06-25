import {
  MapboxNotConfiguredError,
  type IMapboxClient,
  type LngLat,
  type MapboxProfile,
} from "@atlasmed/mapbox";
import { environment } from "../../../../app/config/environment";
import { ValidationError } from "../../../../shared/errors";

function validationError(field: string, message: string): ValidationError {
  return new ValidationError([{ field, message }]);
}

interface Dependencies {
  getClient: () => IMapboxClient;
  isConfigured: () => boolean;
}

function assertConfigured(isConfigured: () => boolean): void {
  if (!isConfigured()) {
    throw new MapboxNotConfiguredError();
  }
}

function parseCoordinates(value: string): LngLat[] {
  const pairs = value
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (pairs.length === 0) {
    throw validationError("coordinates", "At least one coordinate pair is required");
  }

  return pairs.map((pair) => {
    const [lngRaw, latRaw] = pair.split(",").map((part) => part.trim());
    const lng = Number(lngRaw);
    const lat = Number(latRaw);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw validationError("coordinates", `Invalid coordinate pair: ${pair}`);
    }

    return [lng, lat] as LngLat;
  });
}

function parseIndexList(value: string | undefined): number[] | "all" | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "all") {
    return "all";
  }

  return value.split(";").map((part) => {
    const parsed = Number(part.trim());
    if (!Number.isFinite(parsed)) {
      throw validationError("indices", `Invalid index: ${part}`);
    }
    return parsed;
  });
}
function parseNumberList(value: string | undefined): number[] | undefined {
  if (!value) {
    return undefined;
  }

  return value.split(",").map((part) => {
    const parsed = Number(part.trim());
    if (!Number.isFinite(parsed)) {
      throw validationError("contours", `Invalid number: ${part}`);
    }
    return parsed;
  });
}

export class MapboxMapsUseCases {
  constructor(private readonly deps: Dependencies) {}

  getConfig() {
    return {
      configured: this.deps.isConfigured(),
      publicToken: environment.MAPBOX_PUBLIC_TOKEN,
      username: environment.MAPBOX_USERNAME ?? "mapbox",
    };
  }

  async forwardGeocode(input: {
    query: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    const result = await client.forwardGeocode(input);
    return { data: result };
  }

  async reverseGeocode(input: {
    longitude: number;
    latitude: number;
    limit?: number;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    const result = await client.reverseGeocode(input);
    return { data: result };
  }

  async searchSuggest(input: {
    query: string;
    sessionToken: string;
    country?: string;
    proximity?: string;
    limit?: number;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.searchSuggest(input);
  }

  async searchRetrieve(input: { mapboxId: string; sessionToken: string }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.searchRetrieve(input);
  }

  async directions(input: {
    profile: MapboxProfile;
    coordinates: string;
    alternatives?: boolean;
    geometries?: "geojson" | "polyline" | "polyline6";
    overview?: "full" | "simplified" | "false";
    steps?: boolean;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.getDirections({
      profile: input.profile,
      coordinates: parseCoordinates(input.coordinates),
      alternatives: input.alternatives,
      geometries: input.geometries,
      overview: input.overview,
      steps: input.steps,
    });
  }

  async matrix(input: {
    profile: MapboxProfile;
    coordinates: string;
    sources?: string;
    destinations?: string;
    annotations?: "duration" | "distance" | "duration,distance";
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.getMatrix({
      profile: input.profile,
      coordinates: parseCoordinates(input.coordinates),
      sources: parseIndexList(input.sources),
      destinations: parseIndexList(input.destinations),
      annotations: input.annotations,
    });
  }

  async isochrone(input: {
    profile: MapboxProfile;
    longitude: number;
    latitude: number;
    contoursMinutes?: string;
    contoursMeters?: string;
    polygons?: boolean;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.getIsochrone({
      profile: input.profile,
      longitude: input.longitude,
      latitude: input.latitude,
      contoursMinutes: parseNumberList(input.contoursMinutes),
      contoursMeters: parseNumberList(input.contoursMeters),
      polygons: input.polygons,
    });
  }

  async mapMatching(input: {
    profile: MapboxProfile;
    coordinates: string;
    geometries?: "geojson" | "polyline" | "polyline6";
    steps?: boolean;
    tidy?: boolean;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.matchMap({
      profile: input.profile,
      coordinates: parseCoordinates(input.coordinates),
      geometries: input.geometries,
      steps: input.steps,
      tidy: input.tidy,
    });
  }

  async optimization(input: {
    profile: MapboxProfile;
    coordinates: string;
    roundtrip?: boolean;
    source?: "first" | "any";
    destination?: "last" | "any";
    geometries?: "geojson" | "polyline" | "polyline6";
    steps?: boolean;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.optimizeTrip({
      profile: input.profile,
      coordinates: parseCoordinates(input.coordinates),
      roundtrip: input.roundtrip,
      source: input.source,
      destination: input.destination,
      geometries: input.geometries,
      steps: input.steps,
    });
  }

  buildStaticImageUrl(input: {
    longitude: number;
    latitude: number;
    width: number;
    height: number;
    zoom?: number;
    styleId?: string;
    overlay?: string;
    retina?: boolean;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return {
      url: client.buildStaticImageUrl(input),
    };
  }

  async tilequery(input: {
    tilesetId: string;
    longitude: number;
    latitude: number;
    radius?: number;
    limit?: number;
    layers?: string;
  }) {
    assertConfigured(this.deps.isConfigured);
    const client = this.deps.getClient();
    return client.tilequery(input);
  }
}
