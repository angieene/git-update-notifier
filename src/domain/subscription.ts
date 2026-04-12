export interface Subscription {
  id: string;
  email: string;
  repositoryId: number;
  createdAt: Date;
}

export interface NewSubscription {
  email: string;
  repositoryId: number;
}
