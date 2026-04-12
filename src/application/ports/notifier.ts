import type { Release } from '../../domain/release';
import type { TrackedRepo } from '../../domain/tracked-repo';

export interface Notifier {
  notifyNewRelease(to: string, release: Release, repo: TrackedRepo, unsubscribeToken: string): Promise<void>;
  sendConfirmationEmail(to: string, confirmationToken: string): Promise<void>;
}
