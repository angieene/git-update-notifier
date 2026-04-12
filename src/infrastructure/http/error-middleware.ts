import type { NextFunction, Request, Response } from 'express';
import {
  InvalidFormatError,
  RateLimitedError,
  RepoNotFoundError,
  SubscriptionExistsError,
  SubscriptionNotFoundError,
} from '../../domain/errors';
import type { Logger } from '../logger';

export function errorMiddleware(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof InvalidFormatError) {
      res.status(400).json({ code: err.code, message: err.message });
      return;
    }
    if (err instanceof RepoNotFoundError || err instanceof SubscriptionNotFoundError) {
      res.status(404).json({ code: err.code, message: err.message });
      return;
    }
    if (err instanceof SubscriptionExistsError) {
      res.status(409).json({ code: err.code, message: err.message });
      return;
    }
    if (err instanceof RateLimitedError) {
      if (err.retryAfterSeconds) {
        res.setHeader('Retry-After', String(err.retryAfterSeconds));
      }
      res.status(503).json({ code: err.code, message: err.message });
      return;
    }
    logger.error({ err, reqId: req.id }, 'unhandled error');
    res.status(500).json({ code: 'internal_error', message: 'internal error' });
  };
}
