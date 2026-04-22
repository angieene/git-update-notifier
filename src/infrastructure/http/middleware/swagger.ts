import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Application, NextFunction, Request, Response } from 'express';
import { load } from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

export function mountSwagger(app: Application, path = '/docs'): void {
  const specPath = join(__dirname, '../../../../api/openapi.yaml');
  const frozenSpec = load(readFileSync(specPath, 'utf8')) as Record<string, unknown>;

  app.use(
    path,
    swaggerUi.serve,
    (req: Request, res: Response, next: NextFunction) => {
      const spec = {
        ...frozenSpec,
        host: req.get('host') ?? 'localhost:3000',
        schemes: [req.protocol],
      };
      swaggerUi.setup(spec, { customSiteTitle: 'Release Notifier API' })(req, res, next);
    },
  );
}
