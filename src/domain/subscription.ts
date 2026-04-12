export interface Subscription {
  id: string;
  email: string;
  repositoryId: number;
  createdAt: Date;
  confirmationToken: string | null;
  confirmedAt: Date | null;
  unsubscribeToken: string | null;
}

export interface NewSubscription {
  email: string;
  repositoryId: number;
  confirmationToken: string;
  unsubscribeToken: string;
}
