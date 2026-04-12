import type { ListFilter } from '../../domain/list-filter';
import type { NewSubscription, Subscription } from '../../domain/subscription';
import type { TrackedRepo } from '../../domain/tracked-repo';

export interface SubscriptionRepository {
  create(sub: NewSubscription): Promise<Subscription>;
  list(filter: ListFilter): Promise<Subscription[]>;
  delete(id: string): Promise<void>;
  upsertRepo(owner: string, name: string, initialTag: string | null): Promise<TrackedRepo>;
  listActiveRepos(): Promise<TrackedRepo[]>;
  advanceLastSeen(repoId: number, tag: string): Promise<void>;
  listSubscribersForRepo(repoId: number): Promise<string[]>;
}
