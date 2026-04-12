import {
  InvalidFormatError,
  RepoNotFoundError,
  SubscriptionExistsError,
  SubscriptionNotFoundError,
} from '../domain/errors';
import type { ListFilter } from '../domain/list-filter';
import type { Subscription } from '../domain/subscription';
import type { ReleaseSource } from './ports/release-source';
import type { SubscriptionRepository } from './ports/subscription-repository';

const OWNER_REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export class SubscriptionService {
  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly source: ReleaseSource,
  ) {}

  async create(email: string, ownerRepo: string): Promise<Subscription> {
    if (!email.includes('@')) {
      throw new InvalidFormatError('invalid email address');
    }
    if (!OWNER_REPO_RE.test(ownerRepo)) {
      throw new InvalidFormatError('repository must be in "owner/repo" format');
    }

    const [owner, name] = ownerRepo.split('/') as [string, string];

    // Validate repo exists on GitHub (throws RepoNotFoundError if not)
    await this.source.repoExists(owner, name);

    // Seed last_seen_tag on first subscription — fetch silently, null on no releases
    let initialTag: string | null = null;
    try {
      const latest = await this.source.latestRelease(owner, name);
      initialTag = latest.tag;
    } catch {
      // No releases yet — fine, we'll catch the first one on the next scan
    }

    const tracked = await this.repo.upsertRepo(owner, name, initialTag);

    // Check for duplicate subscription
    const existing = await this.repo.list({ email });
    if (existing.some((s) => s.repositoryId === tracked.id)) {
      throw new SubscriptionExistsError(`${email} is already subscribed to ${ownerRepo}`);
    }

    return this.repo.create({ email, repositoryId: tracked.id });
  }

  async list(filter: ListFilter): Promise<Subscription[]> {
    return this.repo.list(filter);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.list({});
    const found = existing.find((s) => s.id === id);
    if (!found) {
      throw new SubscriptionNotFoundError(`subscription not found: ${id}`);
    }
    return this.repo.delete(id);
  }
}

// Re-export for convenience
export { RepoNotFoundError, SubscriptionExistsError, SubscriptionNotFoundError };
