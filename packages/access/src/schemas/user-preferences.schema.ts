import { z } from 'zod'

export const userPreferencesSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).default('system'),
    pushNotificationsEnabled: z.boolean().default(true),
    emailNotificationsEnabled: z.boolean().default(true),
    smsNotificationsEnabled: z.boolean().default(false)
  })
  .strict()

export const updateUserPreferencesSchema = userPreferencesSchema.partial().strict()

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>
