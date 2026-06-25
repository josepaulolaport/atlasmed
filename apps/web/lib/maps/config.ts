import { mapsApi, type MapsConfig } from "@/lib/api/maps";

let cachedConfig: MapsConfig | null = null;
let configPromise: Promise<MapsConfig> | null = null;

export async function getCachedMapsConfig(): Promise<MapsConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!configPromise) {
    configPromise = mapsApi.getConfig().then((config) => {
      cachedConfig = config;
      return config;
    });
  }

  return configPromise;
}

export function clearMapsConfigCache(): void {
  cachedConfig = null;
  configPromise = null;
}
