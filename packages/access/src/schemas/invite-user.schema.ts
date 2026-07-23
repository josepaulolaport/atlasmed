import { z } from "zod";

const sectorAssignmentSchema = z.object({
  sectorId: z.string().min(1),
  managerId: z.string().min(1).optional(),
  territoryIds: z.array(z.string().min(1)).default([]),
});

/**
 * Invite payload.
 *
 * Prefer `sectorAssignments` (multi-sector). Legacy single-territory fields
 * remain for web clients; when both are sent, `sectorAssignments` wins.
 */
export const inviteUserSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
    roleId: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD"),
    managerId: z.string().optional(),
    managerTerritoryId: z.string().optional(),
    repTerritoryId: z.string().optional(),
    sectorAssignments: z.array(sectorAssignmentSchema).optional(),
  })
  .refine((data) => data.email || data.phoneNumber, {
    message: "Either email or phone number is required",
    path: ["email"],
  });

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type InviteSectorAssignmentInput = z.infer<typeof sectorAssignmentSchema>;
