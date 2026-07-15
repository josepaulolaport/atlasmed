import { describe, expect, it } from 'bun:test'

describe('Professional source upsert manual edit protection', () => {
  it('skips overwriting person fields when manuallyEditedAt is set', () => {
    const existing = {
      manuallyEditedAt: new Date('2026-01-01'),
      sourceContentHash: 'hash-1'
    }

    const sourcePersonFields = {
      firstName: 'Source',
      lastName: 'Name',
      fullName: 'Source Name',
      socialName: 'Source Social',
      taxId: '52998224725',
      primarySpecialtyLabel: 'Cardiology',
      crmCouncil: 'CRM',
      crmNumber: '123456',
      crmState: 'SP'
    }

    const input = {
      ...sourcePersonFields,
      sourceContentHash: 'hash-2',
      sourceLastSeenAt: new Date()
    }

    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true
    }

    if (!existing.manuallyEditedAt) {
      Object.assign(updateData, sourcePersonFields)
    }

    expect(updateData.firstName).toBeUndefined()
    expect(updateData.taxId).toBeUndefined()
    expect(updateData.crmNumber).toBeUndefined()
    expect(updateData.sourceContentHash).toBe('hash-2')
  })
})
