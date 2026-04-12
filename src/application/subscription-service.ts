import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  InvalidFormatError,
  RepoNotFoundError,
  SubscriptionExistsError,
  SubscriptionNotFoundError,
  TokenNotFoundError,
} from '../domain/errors';
import type { ListFilter } from '../domain/list-filter';
import type { Subscription } from '../domain/subscription';
import type { Notifier } from './ports/notifier';
import type { ReleaseSource } from './ports/release-source';
import type { SubscriptionRepository, SubscriptionWithRepo } from './ports/subscription-repository';

const OWNER_REPO_RE = /^[\w.-]+\/[\w.-]+$/;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export class SubscriptionService {
  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly source: ReleaseSource,
    private readonly notifier: Notifier,
  ) {}

  async create(email: string, ownerRepo: string): Promise<Subscription> {
    if (!z.string().email().safeParse(email).success) {
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

    const confirmationToken = generateToken();
    const unsubscribeToken = generateToken();

    const { subscription } = await this.repo.createSubscriptionWithRepo(
      email,
      owner,
      name,
      initialTag,
      confirmationToken,
      unsubscribeToken,
    );

    await this.notifier.sendConfirmationEmail(email, confirmationToken);

    return subscription;
  }

  async confirm(token: string): Promise<void> {
    await this.repo.confirmByToken(token);
  }

  async unsubscribeByToken(token: string): Promise<void> {
    await this.repo.deleteByUnsubscribeToken(token);
  }

  async list(filter: ListFilter): Promise<Subscription[]> {
    return this.repo.list(filter);
  }

  async listWithRepo(filter: ListFilter): Promise<SubscriptionWithRepo[]> {
    return this.repo.listWithRepo(filter);
  }

  async delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}

// Re-export for convenience
export { RepoNotFoundError, SubscriptionExistsError, SubscriptionNotFoundError, TokenNotFoundError };
