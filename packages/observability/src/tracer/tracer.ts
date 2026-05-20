export type TraceAttributes = Record<string, string | number | boolean | undefined | null>

export interface TraceSpan {
  end(): void
}

export interface Tracer {
  start(name: string, attributes?: TraceAttributes): TraceSpan
  end(span: TraceSpan): void
  with<T>(name: string, fn: (span: TraceSpan) => T, attributes?: TraceAttributes): T
  with<T>(
    name: string,
    fn: (span: TraceSpan) => Promise<T>,
    attributes?: TraceAttributes
  ): Promise<T>
}
