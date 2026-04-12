import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Notifier } from '../../application/ports/notifier';
import type { Release } from '../../domain/release';
import type { TrackedRepo } from '../../domain/tracked-repo';
import type { Logger } from '../logger';
import { renderBody, renderSubject } from './templates/new-release';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  appBaseUrl: string;
}

export class SmtpNotifier implements Notifier {
  private readonly transporter: Transporter;

  constructor(
    private readonly config: SmtpConfig,
    private readonly logger: Logger,
  ) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: config.password },
    });
  }

  async notifyNewRelease(to: string, release: Release, repo: TrackedRepo, unsubscribeToken: string): Promise<void> {
    const ctx = { repo, release, unsubscribeToken, appBaseUrl: this.config.appBaseUrl };
    const subject = renderSubject(ctx);
    const text = renderBody(ctx);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        text,
      });
    } catch (err) {
      this.logger.warn({ err, to, tag: release.tag }, 'smtp send failed');
      throw err;
    }
  }

  async sendConfirmationEmail(to: string, confirmationToken: string): Promise<void> {
    const confirmUrl = `${this.config.appBaseUrl}/api/confirm/${confirmationToken}`;
    const subject = 'Confirm your GitHub release subscription';
    const text = [
      'You have subscribed to GitHub release notifications.',
      '',
      `Please confirm your subscription by visiting:`,
      confirmUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n');

    try {
      await this.transporter.sendMail({ from: this.config.from, to, subject, text });
    } catch (err) {
      this.logger.warn({ err, to }, 'smtp confirmation send failed');
      throw err;
    }
  }
}
