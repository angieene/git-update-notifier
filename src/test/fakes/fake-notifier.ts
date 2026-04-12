import type { Notifier, NotificationPayload } from '../../application/ports/notifier';

export class FakeNotifier implements Notifier {
  readonly sent: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<void> {
    this.sent.push(payload);
  }
}
