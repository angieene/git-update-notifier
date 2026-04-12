import type { SubscriberInfo, SubscriptionRepository, SubscriptionWithRepo } from '../../application/ports/subscription-repository';
import { SubscriptionExistsError, SubscriptionNotFoundError, TokenNotFoundError } from '../../domain/errors';
import type { ListFilter } from '../../domain/list-filter';
import type { NewSubscription, Subscription } from '../../domain/subscription';
import type { TrackedRepo } from '../../domain/tracked-repo';

export class FakeSubscriptionRepository implements SubscriptionRepository {
  readonly subscriptions: Subscription[] = [];
  readonly repos: TrackedRepo[] = [];
  private idCounter = 1;
  private repoCounter = 1;

  async create(sub: NewSubscription): Promise<Subscription> {
    const s: Subscription = {
      id: String(this.idCounter++),
      email: sub.email,
      repositoryId: sub.repositoryId,
      createdAt: new Date(),
      confirmationToken: sub.confirmationToken,
      confirmedAt: null,
      unsubscribeToken: sub.unsubscribeToken,
    };
    this.subscriptions.push(s);
    return s;
  }

  async list(filter: ListFilter): Promise<Subscription[]> {
    let results = this.subscriptions.slice();
    if (filter.email) results = results.filter((s) => s.email === filter.email);
    if (filter.offset) results = results.slice(filter.offset);
    if (filter.limit) results = results.slice(0, filter.limit);
    return results;
  }

  async listWithRepo(filter: ListFilter): Promise<SubscriptionWithRepo[]> {
    const subs = await this.list(filter);
    return subs.map((s) => {
      const repo = this.repos.find((r) => r.id === s.repositoryId);
      if (!repo) throw new Error(`repo ${s.repositoryId} not found in fake`);
      return { subscription: s, owner: repo.owner, name: repo.name, lastSeenTag: repo.lastSeenTag };
    });
  }

  async delete(id: string): Promise<void> {
    const idx = this.subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) throw new SubscriptionNotFoundError(`subscription not found: ${id}`);
    this.subscriptions.splice(idx, 1);
  }

  async upsertRepo(owner: string, name: string, initialTag: string | null): Promise<TrackedRepo> {
    const existing = this.repos.find((r) => r.owner === owner && r.name === name);
    if (existing) return existing;
    const repo: TrackedRepo = {
      id: this.repoCounter++,
      owner,
      name,
      lastSeenTag: initialTag,
      lastCheckedAt: null,
    };
    this.repos.push(repo);
    return repo;
  }

  async listActiveRepos(): Promise<TrackedRepo[]> {
    const activeRepoIds = new Set(
      this.subscriptions.filter((s) => s.confirmedAt !== null).map((s) => s.repositoryId),
    );
    return this.repos.filter((r) => activeRepoIds.has(r.id));
  }

  async advanceLastSeen(repoId: number, tag: string): Promise<void> {
    const repo = this.repos.find((r) => r.id === repoId);
    if (repo) repo.lastSeenTag = tag;
  }

  async listSubscribersForRepo(repoId: number): Promise<SubscriberInfo[]> {
    return this.subscriptions
      .filter((s) => s.repositoryId === repoId && s.confirmedAt !== null)
      .map((s) => ({ email: s.email, unsubscribeToken: s.unsubscribeToken ?? '' }));
  }

  async confirmByToken(token: string): Promise<void> {
    const sub = this.subscriptions.find((s) => s.confirmationToken === token && s.confirmedAt === null);
    if (!sub) throw new TokenNotFoundError('invalid or already used confirmation token');
    sub.confirmedAt = new Date();
  }

  async deleteByUnsubscribeToken(token: string): Promise<void> {
    const idx = this.subscriptions.findIndex((s) => s.unsubscribeToken === token);
    if (idx === -1) throw new TokenNotFoundError('invalid unsubscribe token');
    this.subscriptions.splice(idx, 1);
  }

  // Test helpers

  seedRepo(data: { owner: string; name: string; lastSeenTag?: string | null }): TrackedRepo {
    const repo: TrackedRepo = {
      id: this.repoCounter++,
      owner: data.owner,
      name: data.name,
      lastSeenTag: data.lastSeenTag ?? null,
      lastCheckedAt: null,
    };
    this.repos.push(repo);
    return repo;
  }

  seedSubscription(data: {
    email: string;
    repositoryId: number;
    confirmed?: boolean;
    confirmationToken?: string;
    unsubscribeToken?: string;
  }): Subscription {
    const sub: Subscription = {
      id: String(this.idCounter++),
      email: data.email,
      repositoryId: data.repositoryId,
      createdAt: new Date(),
      confirmationToken: data.confirmationToken ?? `confirm-${this.idCounter}`,
      confirmedAt: data.confirmed ? new Date() : null,
      unsubscribeToken: data.unsubscribeToken ?? `unsub-${this.idCounter}`,
    };
    this.subscriptions.push(sub);
    return sub;
  }

  getRepoById(id: number): TrackedRepo {
    const repo = this.repos.find((r) => r.id === id);
    if (!repo) throw new Error(`repo ${id} not found in fake`);
    return repo;
  }

  async createSubscriptionWithRepo(
    email: string,
    owner: string,
    name: string,
    initialTag: string | null,
    confirmationToken: string,
    unsubscribeToken: string,
  ): Promise<{ subscription: Subscription; repo: TrackedRepo }> {
    const repo = await this.upsertRepo(owner, name, initialTag);
    const alreadyExists = this.subscriptions.some(
      (s) => s.email === email && s.repositoryId === repo.id,
    );
    if (alreadyExists) throw new SubscriptionExistsError('already subscribed');
    const subscription = await this.create({ email, repositoryId: repo.id, confirmationToken, unsubscribeToken });
    return { subscription, repo };
  }
}
