import type {
  DirectionsParams,
  DirectionsResponse,
} from "../types/directions";
import type {
  ForwardGeocodeParams,
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

export interface IMapboxClient {
  forwardGeocode(params: ForwardGeocodeParams): Promise<GeocodeResult | null>;
  reverseGeocode(params: ReverseGeocodeParams): Promise<GeocodeResult | null>;
  geocodeForwardRaw(params: ForwardGeocodeParams): Promise<GeocodeResponse>;
  geocodeReverseRaw(params: ReverseGeocodeParams): Promise<GeocodeResponse>;

  searchSuggest(params: SearchBoxSuggestParams): Promise<SearchBoxSuggestResponse>;
  searchRetrieve(params: SearchBoxRetrieveParams): Promise<SearchBoxRetrieveResponse>;

  getDirections(params: DirectionsParams): Promise<DirectionsResponse>;
  getMatrix(params: MatrixParams): Promise<MatrixResponse>;
  getIsochrone(params: IsochroneParams): Promise<IsochroneResponse>;
  matchMap(params: MapMatchingParams): Promise<MapMatchingResponse>;
  optimizeTrip(params: OptimizationParams): Promise<OptimizationResponse>;

  buildStaticImageUrl(params: StaticImageParams): string;
  tilequery(params: TilequeryParams): Promise<TilequeryResponse>;
}
