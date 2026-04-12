import express from 'express';
import type { SubscriptionService } from '../../application/subscription-service';
import type { Logger } from '../logger';
import { errorMiddleware } from './error-middleware';
import { loggingMiddleware } from './middleware/logging';
import { requestIdMiddleware } from './middleware/request-id';
import { createSubscriptionRouter } from './subscription-router';

export function createHttpApp(svc: SubscriptionService, logger: Logger): express.Application {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(loggingMiddleware(logger));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', createSubscriptionRouter(svc));

  // Error handler must be last
  app.use(errorMiddleware(logger));

  return app;
}
