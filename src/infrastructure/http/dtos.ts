import type { SubscriptionWithRepo } from '../../application/ports/subscription-repository';

export interface SubscriptionDto {
  email: string;
  repo: string;
  confirmed: boolean;
  last_seen_tag: string | null;
}

export function toSubscriptionDto({ subscription, owner, name, lastSeenTag }: SubscriptionWithRepo): SubscriptionDto {
  return {
    email: subscription.email,
    repo: `${owner}/${name}`,
    confirmed: subscription.confirmedAt !== null,
    last_seen_tag: lastSeenTag,
  };
}
