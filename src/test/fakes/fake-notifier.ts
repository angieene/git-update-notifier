import type { Notifier } from '../../application/ports/notifier';
import type { Release } from '../../domain/release';
import type { TrackedRepo } from '../../domain/tracked-repo';

export interface SentNotification {
  to: string;
  release: Release;
  repo: TrackedRepo;
  unsubscribeToken: string;
}

export class FakeNotifier implements Notifier {
  readonly sent: SentNotification[] = [];
  readonly confirmationsSent: Array<{ to: string; confirmationToken: string }> = [];

  async notifyNewRelease(to: string, release: Release, repo: TrackedRepo, unsubscribeToken: string): Promise<void> {
    this.sent.push({ to, release, repo, unsubscribeToken });
  }

  async sendConfirmationEmail(to: string, confirmationToken: string): Promise<void> {
    this.confirmationsSent.push({ to, confirmationToken });
  }
}
