import { z } from "zod";

const geoJsonBoundarySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.unknown(),
});

/** Draft rep patch created at invite time (empty UTA until accept). */
export const inviteNewPatchSchema = z.object({
  name: z.string().min(1).max(200),
  managerZoneId: z.coerce.number().int().positive(),
  slug: z.string().min(1).max(120).optional(),
  boundary: geoJsonBoundarySchema,
});

const verticalAssignmentSchema = z
  .object({
    verticalId: z.coerce.number().int().positive(),
    /** MANAGER: manager zone ids. REP: empty patch ids (after newPatch resolve). */
    territoryIds: z.array(z.coerce.number().int().positive()).default([]),
    /** REP only — create empty patch under zone, then stage its id. */
    newPatch: inviteNewPatchSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newPatch && data.territoryIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either territoryIds or newPatch, not both",
        path: ["newPatch"],
      });
    }
  });

/**
 * Invite payload (territory-derived manager link — no managerId).
 *
 * REP: per vertical, one empty patch (`territoryIds`) or `newPatch`.
 * MANAGER: per vertical, one or more empty manager zones.
 * OPS: verticals only (empty territoryIds).
 */
export const inviteUserSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
    roleId: z.coerce.number().int().positive(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD"),
    verticalAssignments: z.array(verticalAssignmentSchema).optional(),
  })
  .refine((data) => data.email || data.phoneNumber, {
    message: "Either email or phone number is required",
    path: ["email"],
  });

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type InviteVerticalAssignmentInput = z.infer<typeof verticalAssignmentSchema>;
export type InviteNewPatchInput = z.infer<typeof inviteNewPatchSchema>;
