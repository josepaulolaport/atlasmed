import { z } from "zod";
import { inviteNewPatchSchema } from "./invite-user.schema";

const verticalAssignmentSchema = z
  .object({
    verticalId: z.string().min(1),
    territoryIds: z.array(z.string().min(1)).default([]),
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
  verticalAssignments: z.array(verticalAssignmentSchema).optional(),
});

export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;
