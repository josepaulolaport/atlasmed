import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityGeocodingService } from "../../composition";

/**
 * Turning an address into a pin and a pin back into an address, for the CNES
 * import wizard.
 *
 * Server-side rather than a direct Mapbox call from the app, so the wizard
 * lands on the same coordinates the backfill script would have chosen: the
 * service it delegates to does the CEP lookup and the candidate scoring, and a
 * client hitting Mapbox raw would skip both and disagree with the rest of the
 * data about the same address.
 *
 * Spec 0009 decision 4 is why reverse exists at all — an address and a pin are
 * two views of one fact, so moving the pin re-derives the address.
 */
export const facilityGeocodingRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "FACILITY"))
  .post(
    "/facilities/geocode",
    async ({ body }) => {
      const point = await facilityGeocodingService.geocodeAddress({
        streetAddress: body.streetAddress ?? null,
        streetNumber: body.streetNumber ?? null,
        neighborhood: body.neighborhood ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        postalCode: body.postalCode ?? null,
      });

      // Null rather than an error: an address Mapbox cannot place is an
      // ordinary outcome here, and the wizard's answer to it is to let the
      // person drop the pin themselves.
      return { point };
    },
    {
      detail: {
        summary: "Resolve a facility address to coordinates",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        streetAddress: t.Optional(t.String()),
        streetNumber: t.Optional(t.String()),
        neighborhood: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        postalCode: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/facilities/reverse-geocode",
    async ({ body }) => {
      const described = await facilityGeocodingService.describePointParts({
        lat: body.lat,
        lng: body.lng,
      });
      return described ?? { fullAddress: null, parts: {} };
    },
    {
      detail: {
        summary: "Describe the address a dropped pin sits at",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        lat: t.Number({ minimum: -90, maximum: 90 }),
        lng: t.Number({ minimum: -180, maximum: 180 }),
      }),
    }
  );
