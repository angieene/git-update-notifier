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

      try {
        const release = await this.source.latestRelease(r.owner, r.name);

        // First scan seeds the tag but sends no notification
        if (r.lastSeenTag === null) {
          await this.repo.advanceLastSeen(r.id, release.tag);
          continue;
        }

        // No new release
        if (release.tag === r.lastSeenTag) continue;

        const subscribers = await this.repo.listSubscribersForRepo(r.id);

        for (const email of subscribers) {
          if (signal?.aborted) return;
          try {
            await this.notifier.send({ email, ownerRepo: `${r.owner}/${r.name}`, release });
          } catch (err) {
            this.logger.warn({ err, email, repo: `${r.owner}/${r.name}` }, 'notification failed');
          }
        }

        // Advance only after all notifications attempted
        await this.repo.advanceLastSeen(r.id, release.tag);
        this.logger.info(`notified ${subscribers.length} subscriber(s) for ${r.owner}/${r.name}@${release.tag}`);
      } catch (err) {
        if (err instanceof RateLimitedError) {
          this.logger.warn('rate limited, abandoning tick');
          return;
        }
        this.logger.warn({ err, repo: `${r.owner}/${r.name}` }, 'scan failed for repo');
      }
    }
  }
}
