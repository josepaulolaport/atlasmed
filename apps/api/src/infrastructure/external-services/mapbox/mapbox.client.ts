import {
  createMapboxClient,
  MapboxNotConfiguredError,
  type IMapboxClient,
} from "@atlasmed/mapbox";
import { environment } from "../../../app/config/environment";

let mapboxClient: IMapboxClient | null = null;

export function getMapboxClient(): IMapboxClient {
  if (!environment.MAPBOX_SECRET_TOKEN) {
    throw new MapboxNotConfiguredError();
  }

  if (!mapboxClient) {
    mapboxClient = createMapboxClient({
      accessToken: environment.MAPBOX_SECRET_TOKEN,
      username: environment.MAPBOX_USERNAME,
    });
  }

  return mapboxClient;
}

export function isMapboxConfigured(): boolean {
  return Boolean(environment.MAPBOX_SECRET_TOKEN);
}
