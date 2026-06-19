import { metricsService } from "../../../../infrastructure/monitoring/metrics.service";
import type { IMetrics } from "../../application/interfaces/metrics.interface";

export const metricsAdapter: IMetrics = metricsService;
