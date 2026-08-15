import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { roteiroUseCases } from "../../composition";

type Executable = { execute(input: never): Promise<unknown> };

/**
 * Taken as an argument rather than imported at module load, so the route is
 * mountable in a test — the pattern `orders.route.ts` established. Without it
 * the only possible coverage is unit-level, which is how a dashboard endpoint
 * once shipped as a 500 that no test could see (spec 0014 §8.2).
 */
export interface RoteiroHttpUseCases {
  generate(): Executable;
  confirm(): Executable;
  listAddable(): Executable;
}

/**
 * `POST`, not `GET`, even though generating reads rather than writes.
 *
 * It is not safe to repeat: generation is rate-limited per rep per day (§7.4)
 * and P2 spends a paid Mapbox Matrix call. A GET invites prefetchers, retries
 * and browser caches to run it, and a cached slate is a stale slate.
 */
/**
 * Shared by preview and persist — the workspace regenerates constantly and both
 * paths must accept exactly the same controls, or an edit would behave one way
 * while drafting and another on save.
 */
const generationBody = t.Object({
  verticalId: t.Number({ minimum: 1 }),
  /**
   * Optional: absent means the day's first booked in-person visit is the
   * starting point, and a day with no booking is refused rather than guessed
   * (§15.4.1).
   */
  origin: t.Optional(
    t.Object({
      lat: t.Number({ minimum: -90, maximum: 90 }),
      lng: t.Number({ minimum: -180, maximum: 180 }),
    }),
  ),
  /** The day being planned, `YYYY-MM-DD`. Omitted means today. */
  scopeDate: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  /** Whose day. Omitted means the caller's own. */
  subjectUserId: t.Optional(t.Number({ minimum: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 12 })),
  /** Clinics the rep removed; the freed slot is refilled, not left empty. */
  excludeProfileIds: t.Optional(t.Array(t.Number({ minimum: 1 }), { maxItems: 50 })),
  /** Clinics the rep added by hand, placed ahead of the merit ranking. */
  includeProfileIds: t.Optional(t.Array(t.Number({ minimum: 1 }), { maxItems: 12 })),
  timeZone: t.Optional(t.String({ minLength: 1 })),
});

export const roteiroRoute = (
  useCases: RoteiroHttpUseCases = roteiroUseCases,
  authPlugin: typeof auth = auth,
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("create", "ROTEIRO"))
    .post(
      "/roteiros/preview",
      async ({ body, getScope, getUserId, getAuthContext }) => {
        const [scope, userId, authContext] = await Promise.all([
          getScope(),
          getUserId(),
          getAuthContext(),
        ]);
        const now = new Date();
        return useCases.generate().execute({
          actor: { userId, roleName: authContext.roleName },
          scope,
          subjectUserId: body.subjectUserId,
          verticalId: body.verticalId,
          // Live GPS only — there is deliberately no stored or averaged
          // fallback (§4.1). A centroid of a scattered book lands in empty
          // space, and two of five reps have nothing within 120 km of theirs.
          origin: body.origin ? { lat: body.origin.lat, lng: body.origin.lng } : undefined,
          limit: body.limit,
          excludeProfileIds: body.excludeProfileIds,
          includeProfileIds: body.includeProfileIds,
          today: body.scopeDate ?? localCivilDate(now, body.timeZone),
          now,
          timeZone: body.timeZone,
        } as never);
      },
      {
        detail: {
          summary: "Generate a roteiro do dia without persisting it",
          description:
            "Returns a ranked, explained slate of clinics reachable from the rep's current " +
            "position. Visits already booked for the day are read from the agent's calendar " +
            "and planned around — there is nothing to declare.",
          tags: ["Roteiro"],
          security: [{ bearerAuth: [] }],
        },
        body: generationBody,
      },
    )
    .post(
      "/roteiros",
      async ({ body, getScope, getUserId, getAuthContext }) => {
        const [scope, userId, authContext] = await Promise.all([
          getScope(),
          getUserId(),
          getAuthContext(),
        ]);
        const now = new Date();
        return useCases.generate().execute({
          actor: { userId, roleName: authContext.roleName },
          scope,
          subjectUserId: body.subjectUserId,
          verticalId: body.verticalId,
          origin: body.origin ? { lat: body.origin.lat, lng: body.origin.lng } : undefined,
          limit: body.limit,
          excludeProfileIds: body.excludeProfileIds,
          includeProfileIds: body.includeProfileIds,
          persist: true,
          today: body.scopeDate ?? localCivilDate(now, body.timeZone),
          now,
          timeZone: body.timeZone,
        } as never);
      },
      {
        detail: {
          summary: "Generate and persist a roteiro do dia as a DRAFT",
          description:
            "Supersedes any live DRAFT for the same agent and day, so regenerating replaces " +
            "rather than accumulates. Returns the stored roteiro with its id.",
          tags: ["Roteiro"],
          security: [{ bearerAuth: [] }],
        },
        body: generationBody,
      },
    )
    .get(
      "/roteiros/addable",
      async ({ query, getScope, getUserId, getAuthContext }) => {
        const [scope, userId, authContext] = await Promise.all([
          getScope(),
          getUserId(),
          getAuthContext(),
        ]);
        return useCases.listAddable().execute({
          actor: { userId, roleName: authContext.roleName },
          scope,
          subjectUserId: query.subjectUserId,
          verticalId: query.verticalId,
          query: query.q,
        } as never);
      },
      {
        detail: {
          summary: "Clinics the agent may add to a roteiro by hand",
          description:
            "The agent's own book for the linha, searchable by name. Not narrowed by " +
            "reachability or cooldown — a rep adding a clinic knows something the engine does " +
            "not; whether the day can hold it is generation's answer.",
          tags: ["Roteiro"],
          security: [{ bearerAuth: [] }],
        },
        query: t.Object({
          verticalId: t.Number({ minimum: 1 }),
          q: t.Optional(t.String()),
          subjectUserId: t.Optional(t.Number({ minimum: 1 })),
        }),
      },
    )
    .post(
      "/roteiros/:id/confirm",
      async ({ params, body, getScope, getUserId, getAuthContext }) => {
        const [scope, userId, authContext] = await Promise.all([
          getScope(),
          getUserId(),
          getAuthContext(),
        ]);
        return useCases.confirm().execute({
          roteiroId: params.id,
          actor: { userId, roleName: authContext.roleName },
          scope,
          timeZone: body?.timeZone,
        } as never);
      },
      {
        detail: {
          summary: "Confirm a roteiro, writing it into the agent's calendar",
          description:
            "Creates one calendar event and interaction per stop, with travel-aware start " +
            "times. Idempotent. Returns 409 with the clashing occurrences if the calendar " +
            "changed since the roteiro was generated — times are never silently shifted.",
          tags: ["Roteiro"],
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({ id: t.Number({ minimum: 1 }) }),
        body: t.Optional(t.Object({ timeZone: t.Optional(t.String({ minLength: 1 })) })),
      },
    );

/** The rep's civil date, which is what a roteiro plans — never the server's. */
function localCivilDate(at: Date, timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
