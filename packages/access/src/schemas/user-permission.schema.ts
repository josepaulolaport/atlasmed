import { z } from "zod";

export const grantPermissionSchema = z.object({
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  action: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

export const revokePermissionSchema = grantPermissionSchema;
