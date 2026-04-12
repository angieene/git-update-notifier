import pinoHttp from 'pino-http';
import type { Logger } from '../../logger';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function loggingMiddleware(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req) => (req as Express.Request).id,
  });
}
