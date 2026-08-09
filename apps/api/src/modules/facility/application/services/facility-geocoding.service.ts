import type { GeocodingPort } from "../../../maps/application/interfaces/geocoding.port";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";

export interface ResolvedCoordinates {
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
}

/** Structured facility address used to build a Mapbox forward-geocode query. */
export interface AddressParts {
  streetAddress?: string | null;
  streetNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface GeocodeCandidate {
  latitude: number;
  longitude: number;
  fullAddress?: string;
  name?: string;
}

export interface GeocodeMatchContext {
  city: string;
  state: string;
  neighborhood?: string | null;
  postalCode?: string | null;
}

function trimPart(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Normalize for fuzzy contains checks (case/accents/punctuation). */
export function normalizeAddressText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Expand common Brazilian street abbreviations used in CRM extracts. */
export function expandStreetAbbreviations(street: string): string {
  let text = street.trim();
  const rules: Array<[RegExp, string]> = [
    [/^R\.?\s+/i, "Rua "],
    [/^AV\.?\s+/i, "Avenida "],
    [/^AL\.?\s+/i, "Alameda "],
    [/^TV\.?\s+/i, "Travessa "],
    [/^PC\.?\s+/i, "Praça "],
    [/\bGAL\.?\b/gi, "General"],
    [/\bMAL\.?\b/gi, "Marechal"],
    [/\bDR\.?\b/gi, "Doutor"],
    [/\bPRES\.?\b/gi, "Presidente"],
    [/\bENG\.?\b/gi, "Engenheiro"],
    [/\bPROF\.?\b/gi, "Professor"],
  ];
  for (const [pattern, replacement] of rules) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s+/g, " ").trim();
}

export function formatPostalCode(postalCode: string): string {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return postalCode.trim();
}

/**
 * Compose a Brazilian-oriented geocode query from structured parts.
 * Empty segments are omitted. Returns null when nothing usable remains.
 *
 * Prefer `includeCountry: false` when calling Mapbox with `country=br`
 * (keeps the query under Mapbox's ~20-token limit).
 */
export function composeAddressQuery(
  parts: AddressParts,
  options?: { includeCountry?: boolean }
): string | null {
  const includeCountry = options?.includeCountry ?? true;
  const rawStreet = trimPart(parts.streetAddress);
  const streetAddress = rawStreet ? expandStreetAbbreviations(rawStreet) : null;
  const streetNumber = trimPart(parts.streetNumber);
  // Complements often blow the Mapbox token budget without helping precision.
  const neighborhood = trimPart(parts.neighborhood);
  const city = trimPart(parts.city);
  const state = trimPart(parts.state);
  const rawPostal = trimPart(parts.postalCode);
  const postalCode = rawPostal ? formatPostalCode(rawPostal) : null;
  const country = trimPart(parts.country) ?? "Brazil";

  const streetLine = [streetAddress, streetNumber].filter(Boolean).join(", ");
  const cityState = [city, state].filter(Boolean).join(" - ");

  const hasLocalSignal = Boolean(
    streetAddress || neighborhood || city || postalCode
  );
  if (!hasLocalSignal) {
    return null;
  }

  const segments = [
    streetLine || null,
    neighborhood,
    cityState || null,
    postalCode,
    includeCountry ? country : null,
  ].filter((segment): segment is string => Boolean(segment));

  return segments.join(", ");
}

export interface PostalCodeLookup {
  streetAddress: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

/** Resolve canonical BR address parts from CEP via ViaCEP. */
export async function lookupBrazilianPostalCode(
  postalCode: string,
  fetchImpl: typeof fetch = fetch
): Promise<PostalCodeLookup | null> {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length !== 8) {
    return null;
  }

  try {
    const response = await fetchImpl(
      `https://viacep.com.br/ws/${digits}/json/`
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      cep?: string;
    };
    if (data.erro) {
      return null;
    }
    return {
      streetAddress: trimPart(data.logradouro),
      neighborhood: trimPart(data.bairro),
      city: trimPart(data.localidade),
      state: trimPart(data.uf),
      postalCode: trimPart(data.cep) ?? formatPostalCode(digits),
    };
  } catch {
    return null;
  }
}

/**
 * Prefer ViaCEP street/bairro (canonical for the CEP) over abbreviated CRM text
 * that often confuses Mapbox (e.g. "R GAL MONTEIRO" → wrong "Monteiro *" hits).
 */
export function mergeAddressWithPostalLookup(
  parts: AddressParts,
  lookup: PostalCodeLookup
): AddressParts {
  return {
    ...parts,
    streetAddress: lookup.streetAddress ?? parts.streetAddress,
    neighborhood: lookup.neighborhood ?? parts.neighborhood,
    city: lookup.city ?? parts.city,
    state: lookup.state ?? parts.state,
    postalCode: parts.postalCode ?? lookup.postalCode,
  };
}

function candidateHaystack(candidate: GeocodeCandidate): string {
  return normalizeAddressText(
    [candidate.fullAddress, candidate.name].filter(Boolean).join(" ")
  );
}

/**
 * Pick the Mapbox hit that best matches expected city / neighborhood / CEP.
 * Avoids ranking a same-UF street in another municipality (e.g. Resende vs Botafogo).
 */
export function pickBestGeocodeCandidate(
  candidates: GeocodeCandidate[],
  expected: GeocodeMatchContext
): GeocodeCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const city = normalizeAddressText(expected.city);
  const state = normalizeAddressText(expected.state).slice(0, 2);
  const neighborhood = expected.neighborhood
    ? normalizeAddressText(expected.neighborhood)
    : "";
  const cepDigits = (expected.postalCode ?? "").replace(/\D/g, "");
  const cepPrefix = cepDigits.length >= 5 ? cepDigits.slice(0, 5) : "";

  const anyNeighborhood = Boolean(
    neighborhood &&
      candidates.some((c) => candidateHaystack(c).includes(neighborhood))
  );
  const anyCepPrefix = Boolean(
    cepPrefix &&
      candidates.some((c) => candidateHaystack(c).includes(cepPrefix))
  );

  let best: { candidate: GeocodeCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    const haystack = candidateHaystack(candidate);
    if (!haystack) continue;

    const hasNeighborhood = Boolean(
      neighborhood && haystack.includes(neighborhood)
    );
    const hasCepPrefix = Boolean(cepPrefix && haystack.includes(cepPrefix));
    const hasCityCity = haystack.includes(`${city} ${city}`);
    const hasCityUf =
      state.length === 2 && haystack.includes(`${city} ${state}`);

    // "Resende Rio De Janeiro" when expecting municipality Rio de Janeiro
    // (state name equals city name). Do not apply to São Paulo street noise.
    const otherMunicipalityInRioState =
      city === "RIO DE JANEIRO" &&
      /\b(?!RIO DE JANEIRO)((?:[A-Z]+\s+)+[A-Z]+)\s+RIO DE JANEIRO\b/.test(
        haystack
      ) &&
      !haystack.includes("RIO DE JANEIRO RIO DE JANEIRO");

    let score = 0;
    if (hasCepPrefix) score += 6;
    if (hasNeighborhood) score += 5;
    if (hasCityCity || hasCityUf) score += 4;
    else if (haystack.includes(city) && !otherMunicipalityInRioState) score += 2;

    const strong =
      hasCepPrefix || hasNeighborhood || hasCityCity || hasCityUf;

    if (neighborhood && !strong) {
      continue;
    }
    if (!strong && !haystack.includes(city)) {
      continue;
    }
    if (otherMunicipalityInRioState && !hasCepPrefix && !hasNeighborhood) {
      continue;
    }
    // When a neighborhood/CEP hit exists in the batch, reject weaker city-only pins.
    if (anyNeighborhood && !hasNeighborhood && !hasCepPrefix) {
      continue;
    }
    if (anyCepPrefix && !hasCepPrefix && !hasNeighborhood) {
      continue;
    }

    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }

  return best?.candidate ?? null;
}

export class FacilityGeocodingService {
  constructor(
    private readonly deps: {
      facilityRepository: FacilityRepository;
      geocodingPort?: GeocodingPort;
    }
  ) {}

  async geocodeAddress(
    parts: AddressParts
  ): Promise<{ lat: number; lng: number } | null> {
    if (!this.deps.geocodingPort) {
      return null;
    }

    let enriched = parts;
    const postal = trimPart(parts.postalCode);
    if (postal) {
      const lookup = await lookupBrazilianPostalCode(postal);
      if (lookup) {
        enriched = mergeAddressWithPostalLookup(parts, lookup);
      }
    }

    const query = composeAddressQuery(enriched, { includeCountry: false });
    if (!query) {
      return null;
    }

    const city = trimPart(enriched.city);
    const state = trimPart(enriched.state);
    const port = this.deps.geocodingPort;

    const candidates =
      port.forwardGeocodeMany != null
        ? await port.forwardGeocodeMany({
            query,
            country: "br",
            limit: 5,
          })
        : [
            await port.forwardGeocode({
              query,
              country: "br",
              limit: 1,
            }),
          ].filter((hit): hit is GeocodeCandidate => hit != null);

    if (candidates.length === 0) {
      return null;
    }

    const best =
      city && state
        ? pickBestGeocodeCandidate(candidates, {
            city,
            state,
            neighborhood: enriched.neighborhood,
            postalCode: enriched.postalCode,
          })
        : candidates[0] ?? null;

    if (!best) {
      return null;
    }

    return { lat: best.latitude, lng: best.longitude };
  }

  async resolveCoordinates(input: {
    lat?: number | null;
    lng?: number | null;
    address?: AddressParts | null;
  }): Promise<ResolvedCoordinates> {
    if (input.lat != null && input.lng != null) {
      return { lat: input.lat, lng: input.lng, geocoded: false };
    }

    if (input.address) {
      const geocoded = await this.geocodeAddress(input.address);
      if (geocoded) {
        return { lat: geocoded.lat, lng: geocoded.lng, geocoded: true };
      }
    }

    return {
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      geocoded: false,
    };
  }

  /**
   * Geocodes from address when coordinates are missing and persists them so
   * Mapbox is not called again on subsequent reads or territory assignment.
   */
  async ensureCoordinatesPersisted(facilityId: number): Promise<ResolvedCoordinates | null> {
    const clinic = await this.deps.facilityRepository.findById(facilityId);
    if (!clinic) {
      return null;
    }

    if (clinic.lat != null && clinic.lng != null) {
      return { lat: clinic.lat, lng: clinic.lng, geocoded: false };
    }

    const resolved = await this.resolveCoordinates({
      lat: clinic.lat,
      lng: clinic.lng,
      address: {
        streetAddress: clinic.streetAddress,
        streetNumber: clinic.streetNumber,
        addressComplement: clinic.addressComplement,
        neighborhood: clinic.neighborhood,
        city: clinic.city,
        state: clinic.state,
        postalCode: clinic.postalCode,
      },
    });

    if (resolved.lat == null || resolved.lng == null) {
      return resolved;
    }

    if (resolved.geocoded) {
      await this.deps.facilityRepository.update(facilityId, {
        lat: resolved.lat,
        lng: resolved.lng,
      });
    }

    return resolved;
  }
}
