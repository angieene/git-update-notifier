import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  databaseUrl: z.string().url(),
  githubToken: z.string().min(1),
  smtp: z.object({
    host: z.string().optional(),
    port: z.coerce.number().int().positive().default(587),
    secure: z.coerce.boolean().default(false),
    username: z.string().default(''),
    password: z.string().default(''),
    from: z.string().default('noreply@release-notifier.local'),
  }),
  appBaseUrl: z.string().url().default('http://localhost:3000'),
  redisUrl: z.string().url().optional(),
  scanIntervalMs: z.coerce.number().int().positive().default(300_000),
  scanInitialDelayMs: z.coerce.number().int().nonnegative().default(10_000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse({
    port: process.env['PORT'],
    nodeEnv: process.env['NODE_ENV'],
    databaseUrl: process.env['DATABASE_URL'],
    githubToken: process.env['GITHUB_TOKEN'],
    smtp: {
      host: process.env['SMTP_HOST'],
      port: process.env['SMTP_PORT'],
      secure: process.env['SMTP_SECURE'],
      username: process.env['SMTP_USER'],
      password: process.env['SMTP_PASS'],
      from: process.env['SMTP_FROM'],
    },
    appBaseUrl: process.env['APP_BASE_URL'],
    redisUrl: process.env['REDIS_URL'],
    scanIntervalMs: process.env['SCAN_INTERVAL_MS'],
    scanInitialDelayMs: process.env['SCAN_INITIAL_DELAY_MS'],
  });

  if (!result.success) {
    const messages = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${messages}`);
  }

  return result.data;
}
