import { Elysia, t } from "elysia";
import { MapboxNotConfiguredError, isMapboxProfile } from "@atlasmed/mapbox";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { mapboxMapsUseCases } from "../../composition";
import { ExternalServiceError, ValidationError } from "../../../../shared/errors";

const mapboxProfileSchema = t.Union([
  t.Literal("mapbox/driving"),
  t.Literal("mapbox/driving-traffic"),
  t.Literal("mapbox/walking"),
  t.Literal("mapbox/cycling"),
]);

function handleMapboxError(error: unknown): never {
  if (error instanceof MapboxNotConfiguredError) {
    throw new ExternalServiceError("mapbox");
  }

  throw error;
}

export const mapsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get("/config", () => mapboxMapsUseCases.getConfig())
  .get(
    "/geocode/forward",
    async ({ query }) => {
      try {
        return await mapboxMapsUseCases.forwardGeocode({
          query: query.q,
          country: query.country,
          proximity: query.proximity,
          limit: query.limit ? Number(query.limit) : undefined,
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        country: t.Optional(t.String()),
        proximity: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/geocode/reverse",
    async ({ query }) => {
      try {
        return await mapboxMapsUseCases.reverseGeocode({
          longitude: Number(query.longitude),
          latitude: Number(query.latitude),
          limit: query.limit ? Number(query.limit) : undefined,
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        longitude: t.String(),
        latitude: t.String(),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/search/suggest",
    async ({ query }) => {
      try {
        return await mapboxMapsUseCases.searchSuggest({
          query: query.q,
          sessionToken: query.session_token,
          country: query.country,
          proximity: query.proximity,
          limit: query.limit ? Number(query.limit) : undefined,
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        session_token: t.String({ minLength: 1 }),
        country: t.Optional(t.String()),
        proximity: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/search/retrieve/:mapboxId",
    async ({ params, query }) => {
      try {
        return await mapboxMapsUseCases.searchRetrieve({
          mapboxId: params.mapboxId,
          sessionToken: query.session_token,
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        session_token: t.String({ minLength: 1 }),
      }),
    }
  )
  .get(
    "/directions",
    async ({ query }) => {
      if (!isMapboxProfile(query.profile)) {
        throw new ValidationError([{ field: "profile", message: "Invalid Mapbox profile" }]);
      }

      try {
        return await mapboxMapsUseCases.directions({
          profile: query.profile,
          coordinates: query.coordinates,
          alternatives: query.alternatives === "true",
          geometries: query.geometries,
          overview: query.overview,
          steps: query.steps === "true",
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        profile: mapboxProfileSchema,
        coordinates: t.String({ minLength: 3 }),
        alternatives: t.Optional(t.String()),
        geometries: t.Optional(
          t.Union([t.Literal("geojson"), t.Literal("polyline"), t.Literal("polyline6")])
        ),
        overview: t.Optional(
          t.Union([t.Literal("full"), t.Literal("simplified"), t.Literal("false")])
        ),
        steps: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/matrix",
    async ({ query }) => {
      if (!isMapboxProfile(query.profile)) {
        throw new ValidationError([{ field: "profile", message: "Invalid Mapbox profile" }]);
      }

      try {
        return await mapboxMapsUseCases.matrix({
          profile: query.profile,
          coordinates: query.coordinates,
          sources: query.sources,
          destinations: query.destinations,
          annotations: query.annotations,
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        profile: mapboxProfileSchema,
        coordinates: t.String({ minLength: 3 }),
        sources: t.Optional(t.String()),
        destinations: t.Optional(t.String()),
        annotations: t.Optional(
          t.Union([
            t.Literal("duration"),
            t.Literal("distance"),
            t.Literal("duration,distance"),
          ])
        ),
      }),
    }
  )
  .get(
    "/isochrone",
    async ({ query }) => {
      if (!isMapboxProfile(query.profile)) {
        throw new ValidationError([{ field: "profile", message: "Invalid Mapbox profile" }]);
      }

      try {
        return await mapboxMapsUseCases.isochrone({
          profile: query.profile,
          longitude: Number(query.longitude),
          latitude: Number(query.latitude),
          contoursMinutes: query.contours_minutes,
          contoursMeters: query.contours_meters,
          polygons: query.polygons === "true",
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        profile: mapboxProfileSchema,
        longitude: t.String(),
        latitude: t.String(),
        contours_minutes: t.Optional(t.String()),
        contours_meters: t.Optional(t.String()),
        polygons: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/map-matching",
    async ({ query }) => {
      if (!isMapboxProfile(query.profile)) {
        throw new ValidationError([{ field: "profile", message: "Invalid Mapbox profile" }]);
      }

      try {
        return await mapboxMapsUseCases.mapMatching({
          profile: query.profile,
          coordinates: query.coordinates,
          geometries: query.geometries,
          steps: query.steps === "true",
          tidy: query.tidy === "true",
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        profile: mapboxProfileSchema,
        coordinates: t.String({ minLength: 3 }),
        geometries: t.Optional(
          t.Union([t.Literal("geojson"), t.Literal("polyline"), t.Literal("polyline6")])
        ),
        steps: t.Optional(t.String()),
        tidy: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/optimization",
    async ({ query }) => {
      if (!isMapboxProfile(query.profile)) {
        throw new ValidationError([{ field: "profile", message: "Invalid Mapbox profile" }]);
      }

      try {
        return await mapboxMapsUseCases.optimization({
          profile: query.profile,
          coordinates: query.coordinates,
          roundtrip: query.roundtrip === "true",
          source: query.source,
          destination: query.destination,
          geometries: query.geometries,
          steps: query.steps === "true",
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        profile: mapboxProfileSchema,
        coordinates: t.String({ minLength: 3 }),
        roundtrip: t.Optional(t.String()),
        source: t.Optional(t.Union([t.Literal("first"), t.Literal("any")])),
        destination: t.Optional(t.Union([t.Literal("last"), t.Literal("any")])),
        geometries: t.Optional(
          t.Union([t.Literal("geojson"), t.Literal("polyline"), t.Literal("polyline6")])
        ),
        steps: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/static-image",
    ({ query }) => {
      try {
        return mapboxMapsUseCases.buildStaticImageUrl({
          longitude: Number(query.longitude),
          latitude: Number(query.latitude),
          width: Number(query.width),
          height: Number(query.height),
          zoom: query.zoom ? Number(query.zoom) : undefined,
          styleId: query.style_id,
          overlay: query.overlay,
          retina: query.retina === "true",
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        longitude: t.String(),
        latitude: t.String(),
        width: t.String(),
        height: t.String(),
        zoom: t.Optional(t.String()),
        style_id: t.Optional(t.String()),
        overlay: t.Optional(t.String()),
        retina: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/tilequery",
    async ({ query }) => {
      try {
        return await mapboxMapsUseCases.tilequery({
          tilesetId: query.tileset_id,
          longitude: Number(query.longitude),
          latitude: Number(query.latitude),
          radius: query.radius ? Number(query.radius) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
          layers: query.layers,
        });
      } catch (error) {
        handleMapboxError(error);
      }
    },
    {
      query: t.Object({
        tileset_id: t.String({ minLength: 1 }),
        longitude: t.String(),
        latitude: t.String(),
        radius: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        layers: t.Optional(t.String()),
      }),
    }
  );
