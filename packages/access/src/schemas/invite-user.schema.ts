import { z } from 'zod'

export const inviteUserSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
    roleId: z.string(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    managerId: z.string().optional(),
    managerTerritoryId: z.string().optional(),
    repTerritoryId: z.string().optional()
  })
  .refine((data) => data.email || data.phoneNumber, {
    message: 'Either email or phone number is required',
    path: ['email']
  })

export type InviteUserInput = z.infer<typeof inviteUserSchema>
