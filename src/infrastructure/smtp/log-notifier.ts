import type { Notifier, NotificationPayload } from '../../application/ports/notifier';
import type { Logger } from '../logger';

export class LogNotifier implements Notifier {
  constructor(private readonly logger: Logger) {}

  async send(payload: NotificationPayload): Promise<void> {
    this.logger.info(
      { email: payload.email, repo: payload.ownerRepo, tag: payload.release.tag },
      '[LogNotifier] would send email notification',
    );
  }
}
