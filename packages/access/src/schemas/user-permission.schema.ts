import { z } from "zod";

/** CRM resource id for grants — JSON number; stored as decimal text in DB. */
const grantResourceIdSchema = z.number().int().positive();

export const grantPermissionSchema = z.object({
  resource: z.string().min(1),
  resourceId: grantResourceIdSchema.optional(),
  action: z.string().min(1),
  conditions: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
  expiresAt: z.string().datetime().optional(),
});

export const revokePermissionSchema = grantPermissionSchema;
