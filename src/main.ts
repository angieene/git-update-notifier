import axios from 'axios';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { ScanService } from './application/scan-service';
import { SubscriptionService } from './application/subscription-service';
import { loadConfig } from './config';
import { CachedReleaseSource } from './infrastructure/cache/cached-release-source';
import { GithubReleaseSource } from './infrastructure/github/github-release-source';
import { createHttpApp } from './infrastructure/http/app';
import { createLogger } from './infrastructure/logger';
import { runMigrations } from './infrastructure/postgres/migrations';
import { PgSubscriptionRepository } from './infrastructure/postgres/pg-subscription-repository';
import { startScanner } from './infrastructure/scheduler/start-scanner';
import { LogNotifier } from './infrastructure/log-notifier/log-notifier';
import { SmtpNotifier } from './infrastructure/smtp/smtp-notifier';
import type { ReleaseSource } from './application/ports/release-source';
import type { Notifier } from './application/ports/notifier';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);

  // Infrastructure
  const pool = new Pool({ connectionString: config.databaseUrl });
  await runMigrations(pool, 'migrations');

  const httpClient = axios.create({
    baseURL: 'https://api.github.com',
    timeout: 10_000,
    headers: {
      'User-Agent': 'git-update-subscriber/1.0',
      'Accept': 'application/vnd.github+json',
      ...(config.githubToken ? { 'Authorization': `Bearer ${config.githubToken}` } : {}),
    },
    // Don't throw on non-2xx; let the adapter inspect every response uniformly
    validateStatus: () => true,
  });

  // Adapters
  const repo = new PgSubscriptionRepository(pool);

  let source: ReleaseSource = new GithubReleaseSource(httpClient, logger);
  if (config.redisUrl) {
    const redis = new Redis(config.redisUrl);
    source = new CachedReleaseSource(source, redis, 600);
    logger.info('Redis cache enabled');
  }

  const notifier: Notifier = config.smtp.host
    ? new SmtpNotifier({ ...config.smtp, host: config.smtp.host, appBaseUrl: config.appBaseUrl }, logger)
    : new LogNotifier(logger);

  // Application services
  const subscriptionService = new SubscriptionService(repo, source, notifier);
  const scanService = new ScanService(repo, source, notifier, logger);

  // Transport
  const app = createHttpApp(subscriptionService, logger);
  const server = app.listen(config.port, () => {
    logger.info(`listening on port ${config.port}`);
  });

  // Background scanner
  const stopScanner = startScanner(
    scanService,
    { intervalMs: config.scanIntervalMs, initialDelayMs: config.scanInitialDelayMs },
    logger,
  );

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('shutting down');
    await stopScanner();
    server.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
