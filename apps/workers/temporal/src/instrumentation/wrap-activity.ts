import { createTracer } from "@atlasmed/observability";

const tracer = createTracer("temporal-worker");

export function wrapActivity<T extends (...args: never[]) => Promise<unknown>>(
  name: string,
  fn: T
): T {
  const wrapped = (async (...args: Parameters<T>) => {
    return tracer.with(`activity.${name}`, () => fn(...args), {
      "app.module": "worker",
    });
  }) as T;

  return wrapped;
}
