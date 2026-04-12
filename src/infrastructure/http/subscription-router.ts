import { Router } from 'express';
import { z } from 'zod';
import { InvalidFormatError } from '../../domain/errors';
import type { ListFilter } from '../../domain/list-filter';
import type { SubscriptionService } from '../../application/subscription-service';
import { toSubscriptionDto } from './dtos';

const createSchema = z.object({
  email: z.string().email(),
  repo: z.string(),
});

const listQuerySchema = z.object({
  email: z.string().email(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function createSubscriptionRouter(svc: SubscriptionService): Router {
  const router = Router();

  router.post('/subscribe', async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      await svc.create(body.email, body.repo);
      res.status(200).json({ message: 'Subscription successful. Confirmation email sent.' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new InvalidFormatError(err.issues[0]?.message ?? 'invalid input'));
      }
      next(err);
    }
  });

  router.get('/subscriptions', async (req, res, next) => {
    try {
      const query = listQuerySchema.parse(req.query);
      const filter: ListFilter = { email: query.email };
      if (query.limit !== undefined) filter.limit = query.limit;
      if (query.offset !== undefined) filter.offset = query.offset;
      const subs = await svc.listWithRepo(filter);
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

  router.get('/confirm/:token', async (req, res, next) => {
    try {
      await svc.confirm(req.params['token'] ?? '');
      res.json({ message: 'subscription confirmed' });
    } catch (err) {
      next(err);
    }
  });

  router.get('/unsubscribe/:token', async (req, res, next) => {
    try {
      await svc.unsubscribeByToken(req.params['token'] ?? '');
      res.json({ message: 'unsubscribed successfully' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
