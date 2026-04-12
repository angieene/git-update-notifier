import type { Subscription } from '../../domain/subscription';

export interface SubscriptionDto {
  id: string;
  email: string;
  repositoryId: number;
  createdAt: string;
}

export function toSubscriptionDto(sub: Subscription): SubscriptionDto {
  return {
    id: sub.id,
    email: sub.email,
    repositoryId: sub.repositoryId,
    createdAt: sub.createdAt.toISOString(),
  };
}
