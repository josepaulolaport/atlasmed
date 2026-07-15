import { createTracer } from '@atlasmed/observability'

const tracer = createTracer('cnes-worker')

type ActivityInput = { ingestionRunId?: string }

export function wrapActivity<T extends (...args: never[]) => Promise<unknown>>(
  name: string,
  fn: T
): T {
  const wrapped = (async (...args: Parameters<T>) => {
    const input = args[0] as ActivityInput | undefined
    const ingestionRunId =
      input && typeof input === 'object' && typeof input.ingestionRunId === 'string'
        ? input.ingestionRunId
        : undefined

    return tracer.with(`activity.${name}`, () => fn(...args), {
      'app.module': 'registry',
      ...(ingestionRunId ? { 'ingestion.run.id': ingestionRunId } : {})
    })
  }) as T

  return wrapped
}
