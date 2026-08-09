import { z } from "zod";

export const replaceUserAssignmentsSchema = z.object({
  verticalAssignments: z
    .array(
      z.object({
        verticalId: z.coerce.number().int().positive(),
        territoryIds: z.array(z.coerce.number().int().positive()).default([]),
      }),
    )
    .default([]),
});

export type ReplaceUserAssignmentsInput = z.infer<
  typeof replaceUserAssignmentsSchema
>;
