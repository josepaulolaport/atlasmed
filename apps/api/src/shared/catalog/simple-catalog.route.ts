import { Elysia, t } from "elysia";
import { auth } from "../../modules/access/composition";
import { requirePermission } from "../../modules/access/infrastructure/middleware/permission.middleware";
import {
  CreateSimpleCatalogUseCase,
  UpdateSimpleCatalogUseCase,
  type SimpleCatalogRepository,
} from "./simple-catalog";

/**
 * `POST` and `PATCH` for one small reference catalogue (spec 0016 §5.2).
 *
 * **Writes only.** Each of these catalogues already had a `GET` on its own
 * subject — `read PERSON`, `read FACILITY` — because a rep needs the picker,
 * and those reads stay exactly where they were rather than being re-homed here
 * under a new path. The writes go on `CATALOG`, which only an ADMIN holds.
 *
 * That asymmetry is deliberate and is the same one `listHealthcareProvidersRoute`
 * already documents; it is also why `CATALOG` is the right subject rather than a
 * new one, since it already means "reference data" here.
 *
 * No `DELETE`: every one of these is referenced by operational rows, so
 * retirement is `isActive = false` (spec 0016 §6.2).
 *
 * These catalogues are **global** — no scope parameter, nothing to filter by
 * territory or vertical. Stated rather than left implicit, because an absent
 * `getScope()` in this repository usually means someone forgot.
 *
 * `authPlugin` is a defaulted second parameter, matching every other route
 * factory here: a test may inject a fake, but a caller that passes nothing gets
 * production `auth`. That exact shape is what `route-security.registry.test.ts`
 * looks for — writing the default anywhere else makes the audit read the file as
 * unguarded, which is the audit doing its job.
 */
export function createSimpleCatalogWriteRoutes(options: {
  /** The URL segment, e.g. `clinical-focuses`. */
  path: string;
  /** For `ResourceNotFoundError` and the OpenAPI summaries. */
  resource: string;
  tag: string;
  repository: SimpleCatalogRepository;
  /** The label of the optional second field, when the table has one. */
  extraField?: { name: string; required?: boolean };
}, authPlugin: typeof auth = auth) {
  const { path, resource, tag, repository, extraField } = options;

  const body = {
    name: t.String({ minLength: 1 }),
    isActive: t.Optional(t.Boolean()),
    ...(extraField
      ? {
          extra: extraField.required
            ? t.String({ minLength: 1 })
            : t.Optional(t.Nullable(t.String())),
        }
      : {}),
  };

  const createRoute = new Elysia()
    .use(authPlugin)
    .use(requirePermission("create", "CATALOG"))
    .post(
      `/${path}`,
      async ({ body: input }) =>
        new CreateSimpleCatalogUseCase(repository, {
          resource,
          extraRequired: extraField?.required,
        }).execute(input),
      {
        detail: {
          summary: `Create a ${resource} entry`,
          tags: [tag],
          security: [{ bearerAuth: [] }],
        },
        body: t.Object(body),
      }
    );

  const updateRoute = new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "CATALOG"))
    .patch(
      `/${path}/:id`,
      async ({ params, body: input }) =>
        new UpdateSimpleCatalogUseCase(repository, { resource }).execute({
          id: params.id,
          ...input,
        }),
      {
        detail: {
          summary: `Update a ${resource} entry`,
          tags: [tag],
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({ id: t.Number({ minimum: 1 }) }),
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1 })),
          isActive: t.Optional(t.Boolean()),
          ...(extraField ? { extra: t.Optional(t.Nullable(t.String())) } : {}),
        }),
      }
    );

  return new Elysia().use(createRoute).use(updateRoute);
}
