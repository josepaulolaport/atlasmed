import { z } from "zod";

export const assignUserManagerSchema = z.object({
  managerId: z.number().int().positive().nullable(),
});

export type AssignUserManagerInput = z.infer<typeof assignUserManagerSchema>;

export const assignUserTerritorySchema = z.object({
  territoryId: z.number().int().positive(),
});

export type AssignUserTerritoryInput = z.infer<typeof assignUserTerritorySchema>;
