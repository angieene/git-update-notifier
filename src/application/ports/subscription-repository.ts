import type { ListFilter } from '../../domain/list-filter';
import type { NewSubscription, Subscription } from '../../domain/subscription';
import type { TrackedRepo } from '../../domain/tracked-repo';

export interface SubscriptionWithRepo {
  subscription: Subscription;
  owner: string;
  name: string;
  lastSeenTag: string | null;
}

export interface SubscriberInfo {
  email: string;
  unsubscribeToken: string;
}

export interface SubscriptionRepository {
  create(sub: NewSubscription): Promise<Subscription>;
  list(filter: ListFilter): Promise<Subscription[]>;
  listWithRepo(filter: ListFilter): Promise<SubscriptionWithRepo[]>;
  delete(id: string): Promise<void>;
  upsertRepo(owner: string, name: string, initialTag: string | null): Promise<TrackedRepo>;
  listActiveRepos(): Promise<TrackedRepo[]>;
  advanceLastSeen(repoId: number, tag: string): Promise<void>;
  listSubscribersForRepo(repoId: number): Promise<SubscriberInfo[]>;
  confirmByToken(token: string): Promise<void>;
  deleteByUnsubscribeToken(token: string): Promise<void>;
  createSubscriptionWithRepo(
    email: string,
    owner: string,
    name: string,
    initialTag: string | null,
    confirmationToken: string,
    unsubscribeToken: string,
  ): Promise<{ subscription: Subscription; repo: TrackedRepo }>;
}
