import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Application } from 'express';
import { load } from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

export function mountSwagger(app: Application, path = '/docs'): void {
  const specPath = join(__dirname, '../../../../api/openapi.yaml');
  const spec = load(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
  app.use(path, swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Release Notifier API' }));
}
