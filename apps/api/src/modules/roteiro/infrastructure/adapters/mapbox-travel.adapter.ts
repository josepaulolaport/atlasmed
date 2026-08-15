import type { TravelTimeSource } from "../../application/use-cases/generate-roteiro.use-case";
import type { RoteiroPoint } from "../../application/interfaces/roteiro.repository.interface";
import { mapboxMapsUseCases } from "../../../maps/composition";

/**
 * Drive times from the Mapbox Matrix API — spec 0016 §4.5 step 2.
 *
 * `mapbox/driving`, not `driving-traffic`: the latter caps a matrix at 10
 * coordinates against 25, and a shortlist plus the day's commitments does not
 * fit in 10. Live traffic would be the better number; it is not worth halving
 * the candidate set to get it, and the estimate it replaces is far cruder still.
 *
 * Returns `null` on anything unexpected. The engine treats that as "estimates
 * today" and says so on screen — a rep between clinics has a bad connection
 * more often than a good one, and a feature that fails there is a feature that
 * fails when it is needed.
 */
export class MapboxTravelTimeSource implements TravelTimeSource {
  async durations(points: RoteiroPoint[]): Promise<number[][] | null> {
    if (points.length < 2) return null;
    const response = await mapboxMapsUseCases.matrix({
      profile: "mapbox/driving",
      coordinates: points.map((p) => `${p.lng},${p.lat}`).join(";"),
      annotations: "duration",
    });
    const durations = response?.durations;
    // A matrix missing rows is worse than none: a partial lookup would silently
    // mix real and estimated seconds with no way to tell which is which.
    if (!Array.isArray(durations) || durations.length !== points.length) return null;
    return durations as number[][];
  }
}
