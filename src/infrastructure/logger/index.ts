import pino from 'pino';
import type { Config } from '../../config';

export type Logger = pino.Logger;

export function createLogger(config: Config): Logger {
  return pino({
    level: config.nodeEnv === 'test' ? 'silent' : 'info',
    ...(config.nodeEnv === 'development'
      ? { transport: { target: 'pino/file', options: { destination: 1 } } }
      : {}),
  });
}
