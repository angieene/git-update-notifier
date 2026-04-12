import { RateLimitedError } from '../domain/errors';
import type { Notifier } from './ports/notifier';
import type { ReleaseSource } from './ports/release-source';
import type { SubscriptionRepository } from './ports/subscription-repository';

export interface ScanLogger {
  info(msg: string): void;
  warn(data: object | string, msg?: string): void;
  error(data: object | string, msg?: string): void;
}

export class ScanService {
  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly source: ReleaseSource,
    private readonly notifier: Notifier,
    private readonly logger: ScanLogger,
  ) {}

  async tick(signal?: AbortSignal): Promise<void> {
    const repos = await this.repo.listActiveRepos();

    for (const r of repos) {
      if (signal?.aborted) return;

      let release: Awaited<ReturnType<typeof this.source.latestRelease>>;
      try {
        release = await this.source.latestRelease(r.owner, r.name);
      } catch (err) {
        if (err instanceof RateLimitedError) {
          this.logger.warn({ retryAfter: err.retryAfterSeconds }, 'rate limited, abandoning tick');
          return;
        }
        this.logger.warn({ err, repo: r }, 'scan failed for repo');
        continue;
      }

      if (!release.tag) {
        continue; // repo has no releases yet
      }

      if (r.lastSeenTag === null) {
        await this.repo.advanceLastSeen(r.id, release.tag);
        continue; // silent seed, no notification
      }

      if (r.lastSeenTag === release.tag) {
        continue; // nothing new
      }

      const subscribers = await this.repo.listSubscribersForRepo(r.id);
      for (const sub of subscribers) {
        try {
          await this.notifier.notifyNewRelease(sub.email, release, r, sub.unsubscribeToken);
        } catch (err) {
          this.logger.warn({ err, email: sub.email, tag: release.tag }, 'notification failed');
        }
      }

      await this.repo.advanceLastSeen(r.id, release.tag);
    }
  }
}
