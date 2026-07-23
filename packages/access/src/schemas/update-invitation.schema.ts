import { z } from "zod";

const sectorAssignmentSchema = z.object({
  sectorId: z.string().min(1),
  managerId: z.string().min(1).optional(),
  territoryIds: z.array(z.string().min(1)).default([]),
});

export const updateInvitationSchema = z.object({
  email: z.string().email().optional(),
  phoneNumber: z.string().nullable().optional(),
  roleId: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD")
    .optional(),
  managerId: z.string().optional(),
  managerTerritoryId: z.string().optional(),
  repTerritoryId: z.string().optional(),
  sectorAssignments: z.array(sectorAssignmentSchema).optional(),
});

export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;
