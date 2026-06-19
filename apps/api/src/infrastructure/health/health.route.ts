/**
 * Health Check Routes
 * 
 * Provides comprehensive health monitoring endpoints:
 * - /health/live - Liveness probe (is the app running?)
 * - /health/ready - Readiness probe (can the app serve traffic?)
 * - /health - Detailed health with metrics
 * - /health/metrics - Prometheus metrics
 */

import { Elysia } from "elysia";
import { prisma } from "../database/prisma.client";
import { redis } from "../cache/redis.client";
import { metricsService } from "../monitoring/metrics.service";
import { environment } from "../../app/config/environment";

interface ComponentHealth {
  status: 'up' | 'down';
  message?: string;
  latency?: number;
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    [key: string]: ComponentHealth;
  };
  uptime: number;
}

/**
 * Check database health
 */
async function checkDatabase(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return { 
      status: 'up', 
      latency,
      ...(latency > 100 && { message: 'Slow response' })
    };
  } catch (error) {
    return { 
      status: 'down', 
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    return { 
      status: 'up', 
      latency,
      ...(latency > 50 && { message: 'Slow response' })
    };
  } catch (error) {
    return { 
      status: 'down', 
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Determine overall health status from component checks
 */
function determineOverallStatus(
  checks: Record<string, ComponentHealth>
): HealthCheck['status'] {
  const statuses = Object.values(checks).map(c => c.status);
  
  if (statuses.every(s => s === 'up')) return 'healthy';
  if (statuses.some(s => s === 'down')) return 'unhealthy';
  return 'degraded';
}

/**
 * Get package version from environment or default
 */
function getVersion(): string {
  return process.env.npm_package_version || '1.0.0';
}

export const healthRoute = new Elysia({ 
  prefix: '/health',
  detail: {
    tags: ['Health'],
  }
})
  /**
   * Liveness Probe
   * 
   * Simple check that the application is running.
   * Use this for Kubernetes/Docker liveness probes.
   */
  .get('/live', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }), {
    detail: {
      summary: 'Liveness probe',
      description: 'Check if the application is alive and responding',
      responses: {
        200: {
          description: 'Application is alive',
          content: {
            'application/json': {
              example: {
                status: 'ok',
                timestamp: '2024-01-15T10:00:00Z'
              }
            }
          }
        }
      }
    }
  })
  
  /**
   * Readiness Probe
   * 
   * Checks all dependencies are available.
   * Use this for Kubernetes/Docker readiness probes.
   */
  .get('/ready', async ({ set }) => {
    const [database, redisCheck] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ]);

    const checks = { database, redis: redisCheck };
    const status = determineOverallStatus(checks);

    // Set appropriate status code
    if (status === 'unhealthy') {
      set.status = 503; // Service Unavailable
    } else if (status === 'degraded') {
      set.status = 200; // Still ready but with warnings
    }

    const health: HealthCheck = {
      status,
      timestamp: new Date().toISOString(),
      version: getVersion(),
      environment: environment.NODE_ENV,
      checks,
      uptime: process.uptime()
    };

    return health;
  }, {
    detail: {
      summary: 'Readiness probe',
      description: 'Check if the application is ready to serve traffic',
      responses: {
        200: {
          description: 'Application is ready',
          content: {
            'application/json': {
              example: {
                status: 'healthy',
                timestamp: '2024-01-15T10:00:00Z',
                version: '1.0.0',
                environment: 'production',
                checks: {
                  database: { status: 'up', latency: 5 },
                  redis: { status: 'up', latency: 2 }
                },
                uptime: 3600
              }
            }
          }
        },
        503: {
          description: 'Application is not ready (dependencies unavailable)'
        }
      }
    }
  })
  
  /**
   * Detailed Health Check
   * 
   * Comprehensive health information including system metrics.
   */
  .get('/', async ({ set }) => {
    const [database, redisCheck] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ]);

    const checks = { database, redis: redisCheck };
    const status = determineOverallStatus(checks);

    if (status === 'unhealthy') {
      set.status = 503;
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: getVersion(),
      environment: environment.NODE_ENV,
      checks,
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        unit: 'MB'
      },
      system: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length
      }
    };
  }, {
    detail: {
      summary: 'Detailed health check',
      description: 'Get comprehensive health information including system metrics',
      responses: {
        200: {
          description: 'Health information'
        },
        503: {
          description: 'Service unavailable'
        }
      }
    }
  })
  
  /**
   * Prometheus Metrics
   * 
   * Expose metrics in Prometheus format.
   */
  .get('/metrics', async ({ set }) => {
    if (!environment.ENABLE_METRICS) {
      set.status = 404;
      return { error: 'Metrics are disabled' };
    }
    
    set.headers['content-type'] = 'text/plain; version=0.0.4';
    return await metricsService.getMetrics();
  }, {
    detail: {
      summary: 'Prometheus metrics',
      description: 'Get application metrics in Prometheus format',
      responses: {
        200: {
          description: 'Prometheus metrics',
          content: {
            'text/plain': {
              example: '# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 100'
            }
          }
        },
        404: {
          description: 'Metrics disabled'
        }
      }
    }
  });
