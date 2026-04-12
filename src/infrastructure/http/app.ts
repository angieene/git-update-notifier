import express, { type Request, type Response } from 'express';
import type { SubscriptionService } from '../../application/subscription-service';
import type { Logger } from '../logger';
import { errorMiddleware } from './error-middleware';
import { loggingMiddleware } from './middleware/logging';
import { requestIdMiddleware } from './middleware/request-id';
import { mountSwagger } from './middleware/swagger';
import { createSubscriptionRouter } from './subscription-router';

function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 'not_found', message: 'not found' });
}

export function createHttpApp(svc: SubscriptionService, logger: Logger): express.Application {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(loggingMiddleware(logger));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  mountSwagger(app);

  app.use('/api', createSubscriptionRouter(svc));

  app.use(notFoundHandler);
  app.use(errorMiddleware); // MUST be last — Express detects error handlers by arity (4 args)

  return app;
}
