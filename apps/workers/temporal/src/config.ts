import { environment } from "@atlasmed/config";

export interface WorkerConfig {
  temporalAddress: string;
  temporalNamespace: string;
  taskQueue: string;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    temporalAddress: environment.TEMPORAL_ADDRESS,
    temporalNamespace: environment.TEMPORAL_NAMESPACE,
    taskQueue: environment.TEMPORAL_TASK_QUEUE,
  };
}
