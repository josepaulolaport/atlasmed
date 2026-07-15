import { describe, expect, test } from 'bun:test'
import { workflowIdForReference } from '@atlasmed/cnes-ingestion'

describe('workflow id', () => {
  test('formats cnes ingestion workflow id', () => {
    expect(workflowIdForReference(2026, 6)).toBe('cnes-ingestion-2026-06')
  })
})
