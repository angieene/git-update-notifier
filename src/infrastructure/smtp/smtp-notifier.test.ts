import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmtpConfig } from './smtp-notifier';
import { SmtpNotifier } from './smtp-notifier';

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({}),
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail }),
}));

const testConfig: SmtpConfig = {
  host: 'localhost',
  port: 1025,
  secure: false,
  username: '',
  password: '',
  from: 'test@example.com',
  appBaseUrl: 'http://localhost:3000',
};

const testLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
  level: 'info',
} as any;

const release = {
  tag: 'v1.0.0',
  name: 'First Release',
  url: 'https://github.com/acme/widget/releases/tag/v1.0.0',
  publishedAt: new Date('2024-01-01T00:00:00Z'),
};

const repo = {
  id: 1,
  owner: 'acme',
  name: 'widget',
  lastSeenTag: null,
  lastCheckedAt: null,
};

describe('SmtpNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({});
  });

  it('sends an email with the correct subject', async () => {
    const notifier = new SmtpNotifier(testConfig, testLogger);
    await notifier.notifyNewRelease('user@example.com', release, repo, 'test-unsub-token');

    expect(mockSendMail).toHaveBeenCalledOnce();
    const mail = mockSendMail.mock.calls[0]?.[0] as Record<string, string>;
    expect(mail.to).toBe('user@example.com');
    expect(mail.subject).toBe('New release: acme/widget v1.0.0');
  });

  it('sends an email with repo and tag in the body', async () => {
    const notifier = new SmtpNotifier(testConfig, testLogger);
    await notifier.notifyNewRelease('user@example.com', release, repo, 'test-unsub-token');

    const mail = mockSendMail.mock.calls[0]?.[0] as Record<string, string>;
    expect(mail.text).toContain('acme/widget');
    expect(mail.text).toContain('v1.0.0');
    expect(mail.text).toContain(release.url);
  });

  it('sends from the configured address', async () => {
    const notifier = new SmtpNotifier(testConfig, testLogger);
    await notifier.notifyNewRelease('user@example.com', release, repo, 'test-unsub-token');

    const mail = mockSendMail.mock.calls[0]?.[0] as Record<string, string>;
    expect(mail.from).toBe('test@example.com');
  });

  it('logs a warning and rethrows when sendMail fails', async () => {
    const error = new Error('SMTP connection refused');
    mockSendMail.mockRejectedValueOnce(error);

    const notifier = new SmtpNotifier(testConfig, testLogger);
    await expect(
      notifier.notifyNewRelease('user@example.com', release, repo, 'test-unsub-token'),
    ).rejects.toThrow('SMTP connection refused');

    expect(testLogger.warn).toHaveBeenCalledOnce();
  });
});
