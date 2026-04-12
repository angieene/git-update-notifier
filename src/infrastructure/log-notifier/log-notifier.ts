import type { Notifier } from '../../application/ports/notifier';
import type { Release } from '../../domain/release';
import type { TrackedRepo } from '../../domain/tracked-repo';
import type { Logger } from '../logger';

export class LogNotifier implements Notifier {
  constructor(private readonly logger: Logger) {}

  async notifyNewRelease(to: string, release: Release, repo: TrackedRepo, unsubscribeToken: string): Promise<void> {
    this.logger.info({
      to,
      repo: `${repo.owner}/${repo.name}`,
      tag: release.tag,
      url: release.url,
      unsubscribeToken,
    }, 'would send new-release notification');
  }

  async sendConfirmationEmail(to: string, confirmationToken: string): Promise<void> {
    this.logger.info({ to, confirmationToken }, 'would send confirmation email');
  }
}
