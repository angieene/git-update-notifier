import type { NextFunction, Request, Response } from 'express';
import {
  InvalidFormatError,
  RateLimitedError,
  RepoNotFoundError,
  SubscriptionExistsError,
  SubscriptionNotFoundError,
  TokenNotFoundError,
  UpstreamUnavailableError,
} from '../../domain/errors';

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof InvalidFormatError) {
    res.status(400).json({ code: err.code, message: err.message });
    return;
  }
  if (err instanceof RepoNotFoundError || err instanceof SubscriptionNotFoundError || err instanceof TokenNotFoundError) {
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
  if (err instanceof UpstreamUnavailableError) {
    res.status(502).json({ code: err.code, message: err.message });
    return;
  }

  // Unknown error — log full details via the request-scoped logger set by pino-http
  req.log?.error({ err }, 'unhandled error');
  res.status(500).json({ code: 'internal_error', message: 'internal error' });
}
