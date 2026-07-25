import { z } from "zod";

export const replaceUserAssignmentsSchema = z.object({
  verticalAssignments: z
    .array(
      z.object({
        verticalId: z.string().min(1),
        managerId: z.string().min(1).optional(),
        territoryIds: z.array(z.string().min(1)).default([]),
      }),
    )
    .default([]),
});

export type ReplaceUserAssignmentsInput = z.infer<
  typeof replaceUserAssignmentsSchema
>;
