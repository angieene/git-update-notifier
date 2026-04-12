import type { SubscriptionRepository } from '../../application/ports/subscription-repository';
import { SubscriptionNotFoundError } from '../../domain/errors';
import type { ListFilter } from '../../domain/list-filter';
import type { NewSubscription, Subscription } from '../../domain/subscription';
import type { TrackedRepo } from '../../domain/tracked-repo';

let idCounter = 1;
let repoCounter = 1;

export class FakeSubscriptionRepository implements SubscriptionRepository {
  readonly subscriptions: Subscription[] = [];
  readonly repos: TrackedRepo[] = [];

  async create(sub: NewSubscription): Promise<Subscription> {
    const s: Subscription = {
      id: String(idCounter++),
      email: sub.email,
      repositoryId: sub.repositoryId,
      createdAt: new Date(),
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

  async delete(id: string): Promise<void> {
    const idx = this.subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) throw new SubscriptionNotFoundError(`subscription not found: ${id}`);
    this.subscriptions.splice(idx, 1);
  }

  async upsertRepo(owner: string, name: string, initialTag: string | null): Promise<TrackedRepo> {
    const existing = this.repos.find((r) => r.owner === owner && r.name === name);
    if (existing) return existing;
    const repo: TrackedRepo = {
      id: repoCounter++,
      owner,
      name,
      lastSeenTag: initialTag,
      lastCheckedAt: null,
    };
    this.repos.push(repo);
    return repo;
  }

  async listActiveRepos(): Promise<TrackedRepo[]> {
    const activeRepoIds = new Set(this.subscriptions.map((s) => s.repositoryId));
    return this.repos.filter((r) => activeRepoIds.has(r.id));
  }

  async advanceLastSeen(repoId: number, tag: string): Promise<void> {
    const repo = this.repos.find((r) => r.id === repoId);
    if (repo) repo.lastSeenTag = tag;
  }

  async listSubscribersForRepo(repoId: number): Promise<string[]> {
    return this.subscriptions.filter((s) => s.repositoryId === repoId).map((s) => s.email);
  }
}
