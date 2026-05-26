/**
 * QuestDB Logger
 * 
 * Persists logs and metrics to QuestDB for long-term storage and analysis.
 * Uses InfluxDB Line Protocol for high-performance ingestion.
 */

import { Sender } from '@questdb/nodejs-client';
import { logger } from './logger';

// Import environment with type assertion to include QuestDB fields
const environment = require('../../app/config/environment').environment as any;

interface LogEntry {
  level: string;
  message: string;
  requestId?: string;
  userId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  context?: Record<string, any>;
}

interface MetricEntry {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

class QuestDBLogger {
  private sender: Sender | null = null;
  private enabled: boolean;
  private connected: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;

  constructor() {
    this.enabled = environment.QUESTDB_ENABLED ?? false;
    
    if (this.enabled) {
      this.connect().catch(err => {
        logger.warn({ error: err.message }, 'QuestDB connection failed, will retry');
      });
    }
  }

  private async connect(): Promise<void> {
    if (this.connected || this.connectionAttempts >= this.maxConnectionAttempts) {
      return;
    }

    this.connectionAttempts++;

    try {
      // QuestDB connection string format: tcp::addr=host:port;
      const connectionString = `tcp::addr=${environment.QUESTDB_HOST ?? 'localhost'}:${environment.QUESTDB_PORT ?? 9009};`;
      this.sender = await Sender.fromConfig(connectionString);
      this.connected = true;
      logger.info({
        host: environment.QUESTDB_HOST,
        port: environment.QUESTDB_PORT,
      }, 'QuestDB logger connected');
    } catch (error: any) {
      logger.error({ 
        error: error.message,
        attempt: this.connectionAttempts,
        maxAttempts: this.maxConnectionAttempts,
      }, 'Failed to connect to QuestDB');
      
      // Disable if max attempts reached
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        this.enabled = false;
        logger.warn('QuestDB disabled after max connection attempts');
      }
    }
  }

  /**
   * Log an API request/response
   */
  async log(entry: LogEntry): Promise<void> {
    if (!this.enabled || !this.connected || !this.sender) {
      return;
    }

    try {
      const timestamp = Date.now() * 1000000; // Convert to nanoseconds
      
      this.sender
        .table('api_logs')
        // Symbols (indexed, low cardinality)
        .symbol('level', entry.level)
        .symbol('method', entry.method ?? 'UNKNOWN')
        .symbol('route', this.sanitizeRoute(entry.route ?? 'UNKNOWN'))
        .symbol('service', environment.OTEL_SERVICE_NAME)
        .symbol('environment', environment.NODE_ENV)
        // String columns
        .stringColumn('message', entry.message.substring(0, 500)) // Limit message length
        .stringColumn('request_id', entry.requestId ?? '')
        .stringColumn('user_id', entry.userId ?? '')
        .stringColumn('error', entry.error?.substring(0, 1000) ?? '')
        .stringColumn('context', JSON.stringify(entry.context ?? {}).substring(0, 2000))
        // Numeric columns
        .intColumn('status_code', entry.statusCode ?? 0)
        .floatColumn('duration_ms', entry.durationMs ?? 0)
        // Timestamp
        .at(timestamp);

      await this.sender.flush();
    } catch (error: any) {
      // Don't let logging errors crash the app
      logger.error({ 
        error: error.message,
        entry: {
          level: entry.level,
          route: entry.route,
          requestId: entry.requestId,
        },
      }, 'Failed to write log to QuestDB');
      
      // Disconnect and disable on persistent errors
      if (error.message?.includes('connection') || error.message?.includes('timeout')) {
        this.connected = false;
        this.enabled = false;
      }
    }
  }

  /**
   * Log a metric value
   */
  async logMetric(entry: MetricEntry): Promise<void> {
    if (!this.enabled || !this.connected || !this.sender) {
      return;
    }

    try {
      const timestamp = Date.now() * 1000000;
      
      let row = this.sender.table('api_metrics');
      
      // Add metric name
      row = row.symbol('metric_name', entry.name);
      
      // Add service metadata
      row = row.symbol('service', environment.OTEL_SERVICE_NAME);
      row = row.symbol('environment', environment.NODE_ENV);
      
      // Add custom tags as symbols
      if (entry.tags) {
        for (const [key, val] of Object.entries(entry.tags)) {
          row = row.symbol(key, val);
        }
      }
      
      // Add value and timestamp
      row
        .floatColumn('value', entry.value)
        .at(timestamp);

      await this.sender.flush();
    } catch (error: any) {
      logger.error({ 
        error: error.message,
        metric: entry.name,
      }, 'Failed to write metric to QuestDB');
    }
  }

  /**
   * Sanitize route for storage (remove dynamic segments like IDs)
   */
  private sanitizeRoute(route: string): string {
    // Replace UUIDs with :id
    let sanitized = route.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id'
    );
    
    // Replace numeric IDs with :id
    sanitized = sanitized.replace(/\/\d+(?=\/|$)/g, '/:id');
    
    return sanitized;
  }

  /**
   * Close the connection gracefully
   */
  async close(): Promise<void> {
    if (this.sender) {
      try {
        await this.sender.close();
        this.connected = false;
        logger.info({}, 'QuestDB logger disconnected');
      } catch (error: any) {
        logger.error({ error: error.message }, 'Error closing QuestDB connection');
      } finally {
        this.sender = null;
      }
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Export singleton instance
export const questdbLogger = new QuestDBLogger();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await questdbLogger.close();
});

process.on('SIGINT', async () => {
  await questdbLogger.close();
});
