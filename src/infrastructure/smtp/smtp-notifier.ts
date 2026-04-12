import nodemailer from 'nodemailer';
import type { Notifier, NotificationPayload } from '../../application/ports/notifier';
import type { Config } from '../../config';

export class SmtpNotifier implements Notifier {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(smtp: Config['smtp']) {
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    this.from = smtp.from ?? 'noreply@release-notifier.local';
  }

  async send(payload: NotificationPayload): Promise<void> {
    const { email, ownerRepo, release } = payload;
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: `New release: ${ownerRepo} ${release.tag}`,
      text: [
        `${ownerRepo} just published ${release.tag} — ${release.name}`,
        '',
        release.url,
      ].join('\n'),
      html: [
        `<p><strong>${ownerRepo}</strong> published <strong>${release.tag}</strong> — ${release.name}</p>`,
        `<p><a href="${release.url}">${release.url}</a></p>`,
      ].join('\n'),
    });
  }
}
