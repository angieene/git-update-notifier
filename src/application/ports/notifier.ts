import type { Release } from '../../domain/release';

export interface NotificationPayload {
  email: string;
  ownerRepo: string;
  release: Release;
}

export interface Notifier {
  send(payload: NotificationPayload): Promise<void>;
}
