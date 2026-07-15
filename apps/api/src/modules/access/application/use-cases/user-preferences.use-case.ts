import {
  type UpdateUserPreferencesInput,
  type UserPreferencesInput,
  updateUserPreferencesSchema,
  userPreferencesSchema
} from '@atlasmed/access'
import { ValidationError } from '../../../../shared/errors'
import type { UserRepository } from '../interfaces/user.repository.interface'

interface UserPreferencesDependencies {
  userRepository: UserRepository
}

function parseMetadataPreferences(metadata: unknown): UserPreferencesInput {
  const preferences =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).preferences
      : undefined

  return userPreferencesSchema.parse(
    preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {}
  )
}

function toValidationError(error: unknown): ValidationError {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues =
      (
        error as {
          issues?: Array<{ path: Array<string | number>; message: string }>
        }
      ).issues ?? []
    return new ValidationError(
      issues.map((issue) => ({
        field: issue.path.length ? `body.${issue.path.join('.')}` : 'body',
        message: issue.message
      }))
    )
  }

  return new ValidationError([{ field: 'body', message: 'Invalid preferences' }])
}

export class GetUserPreferencesUseCase {
  constructor(private readonly deps: UserPreferencesDependencies) {}

  async execute(params: { userId: string }): Promise<UserPreferencesInput> {
    const metadata = await this.deps.userRepository.getMetadata(params.userId)
    return parseMetadataPreferences(metadata)
  }
}

export class UpdateUserPreferencesUseCase {
  constructor(private readonly deps: UserPreferencesDependencies) {}

  async execute(
    params: { userId: string } & UpdateUserPreferencesInput
  ): Promise<UserPreferencesInput> {
    const { userId, ...patch } = params
    const parsedPatch = updateUserPreferencesSchema.safeParse(patch)

    if (!parsedPatch.success) {
      throw toValidationError(parsedPatch.error)
    }

    if (Object.keys(parsedPatch.data).length === 0) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'At least one preference field must be provided'
        }
      ])
    }

    const metadata = await this.deps.userRepository.getMetadata(userId)
    const current = parseMetadataPreferences(metadata)
    const next = { ...current, ...parsedPatch.data }

    await this.deps.userRepository.updateMetadata(userId, {
      ...((metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {}) as Record<string, unknown>),
      preferences: next
    })

    return next
  }
}
