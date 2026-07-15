import { Elysia, t } from 'elysia'
import { z } from 'zod'
import { ValidationError } from '../../../../shared/errors'
import { auth } from '../../../access/composition'
import { requirePermission } from '../../../access/infrastructure/middleware/permission.middleware'
import { visitUseCases } from '../../composition'

const recordVisitSchema = z.object({
  facilityId: z.string().min(1),
  visitedAt: z.string().datetime({ offset: true }).optional()
})

function parseRecordVisitBody(body: unknown) {
  const parsed = recordVisitSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message
      }))
    )
  }
  return {
    facilityId: parsed.data.facilityId,
    visitedAt: parsed.data.visitedAt ? new Date(parsed.data.visitedAt) : undefined
  }
}

const recordVisitRoute = new Elysia()
  .use(auth)
  .use(requirePermission('create', 'VISIT'))
  .post(
    '/visits',
    async ({ body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()])
      return visitUseCases.recordVisit().execute({ userId, scope, ...parseRecordVisitBody(body) })
    },
    {
      detail: { summary: 'Record clinic visit', tags: ['Visits'], security: [{ bearerAuth: [] }] },
      body: t.Object({ facilityId: t.String({ minLength: 1 }), visitedAt: t.Optional(t.String()) })
    }
  )

const weeklySummaryRoute = new Elysia()
  .use(auth)
  .use(requirePermission('read', 'VISIT'))
  .get(
    '/visits/weekly-summary',
    async ({ getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()])
      return visitUseCases.getWeeklySummary().execute({ userId, scope })
    },
    {
      detail: {
        summary: 'Get current weekly clinic visit summary',
        tags: ['Visits'],
        security: [{ bearerAuth: [] }]
      }
    }
  )

export const visitsRoute = new Elysia().use(recordVisitRoute).use(weeklySummaryRoute)
