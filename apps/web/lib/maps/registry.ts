import type { TerritoryMapProvider } from "@/components/territory/map/types";

let cachedProvider: TerritoryMapProvider | null = null;

export async function getTerritoryMapProvider(): Promise<TerritoryMapProvider> {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerName = process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "leaflet";

  if (providerName === "mapbox") {
    const mod = await import("@/components/territory/map/providers/mapbox-editor");
    cachedProvider = mod.mapboxTerritoryMapProvider;
    return cachedProvider;
  }

  if (providerName === "leaflet") {
    const mod = await import("@/components/territory/map/providers/leaflet-editor");
    cachedProvider = mod.leafletTerritoryMapProvider;
    return cachedProvider;
  }

  throw new Error(`Unsupported map provider: ${providerName}`);
}
