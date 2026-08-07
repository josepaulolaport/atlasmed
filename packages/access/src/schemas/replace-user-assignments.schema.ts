import { z } from "zod";

export const replaceUserAssignmentsSchema = z.object({
  verticalAssignments: z
    .array(
      z.object({
        verticalId: z.number().int().positive(),
        territoryIds: z.array(z.number().int().positive()).default([]),
      }),
    )
    .default([]),
});

export type ReplaceUserAssignmentsInput = z.infer<
  typeof replaceUserAssignmentsSchema
>;
