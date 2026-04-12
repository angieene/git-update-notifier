import { Router } from 'express';
import { z } from 'zod';
import { InvalidFormatError } from '../../domain/errors';
import type { SubscriptionService } from '../../application/subscription-service';
import { toSubscriptionDto } from './dtos';

const createSchema = z.object({
  email: z.string().email(),
  repository: z.string(),
});

const listSchema = z.object({
  email: z.string().email().optional(),
});

export function createSubscriptionRouter(svc: SubscriptionService): Router {
  const router = Router();

  router.post('/subscriptions', async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const sub = await svc.create(body.email, body.repository);
      res.status(201).json(toSubscriptionDto(sub));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new InvalidFormatError(err.issues[0]?.message ?? 'invalid input'));
      }
      next(err);
    }
  });

  router.get('/subscriptions', async (req, res, next) => {
    try {
      const query = listSchema.parse(req.query);
      const filter: import('../../domain/list-filter').ListFilter = {};
      if (query.email !== undefined) filter.email = query.email;
      const subs = await svc.list(filter);
      res.json(subs.map(toSubscriptionDto));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new InvalidFormatError(err.issues[0]?.message ?? 'invalid query'));
      }
      next(err);
    }
  });

  router.delete('/subscriptions/:id', async (req, res, next) => {
    try {
      await svc.delete(req.params['id'] ?? '');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
