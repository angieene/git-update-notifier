import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionService } from './subscription-service';
import { FakeSubscriptionRepository } from '../test/fakes/fake-subscription-repository';
import { FakeReleaseSource } from '../test/fakes/fake-release-source';
import { FakeNotifier } from '../test/fakes/fake-notifier';
import {
  InvalidFormatError,
  RepoNotFoundError,
  SubscriptionExistsError,
} from '../domain/errors';

const FAKE_RELEASE = {
  tag: 'v1.0.0',
  name: 'v1.0.0',
  url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
  publishedAt: new Date('2024-01-01'),
};

describe('SubscriptionService', () => {
  let repo: FakeSubscriptionRepository;
  let source: FakeReleaseSource;
  let notifier: FakeNotifier;
  let svc: SubscriptionService;

  beforeEach(() => {
    repo = new FakeSubscriptionRepository();
    source = new FakeReleaseSource();
    notifier = new FakeNotifier();
    svc = new SubscriptionService(repo, source, notifier);
    source.setRelease('owner', 'repo', FAKE_RELEASE);
  });

  it('creates a subscription and seeds last_seen_tag', async () => {
    const sub = await svc.create('user@example.com', 'owner/repo');

    expect(sub.email).toBe('user@example.com');
    expect(typeof sub.repositoryId).toBe('number');
    expect(repo.repos[0]?.lastSeenTag).toBe('v1.0.0');
  });

  it('sends a confirmation email on subscribe', async () => {
    await svc.create('user@example.com', 'owner/repo');

    expect(notifier.confirmationsSent).toHaveLength(1);
    expect(notifier.confirmationsSent[0]?.to).toBe('user@example.com');
    expect(typeof notifier.confirmationsSent[0]?.confirmationToken).toBe('string');
  });

  it('rejects invalid email', async () => {
    await expect(svc.create('not-an-email', 'owner/repo')).rejects.toBeInstanceOf(InvalidFormatError);
  });

  it('rejects invalid repo format', async () => {
    await expect(svc.create('user@example.com', 'invalid')).rejects.toBeInstanceOf(InvalidFormatError);
  });

  it('throws RepoNotFoundError when repo does not exist', async () => {
    source.setMissing('owner', 'missing');
    await expect(svc.create('user@example.com', 'owner/missing')).rejects.toBeInstanceOf(RepoNotFoundError);
  });

  it('throws SubscriptionExistsError on duplicate', async () => {
    await svc.create('user@example.com', 'owner/repo');
    await expect(svc.create('user@example.com', 'owner/repo')).rejects.toBeInstanceOf(SubscriptionExistsError);
  });

  it('lists subscriptions by email', async () => {
    await svc.create('a@example.com', 'owner/repo');
    await svc.create('b@example.com', 'owner/repo');

    const result = await svc.list({ email: 'a@example.com' });
    expect(result).toHaveLength(1);
    expect(result[0]?.email).toBe('a@example.com');
  });

  it('deletes a subscription', async () => {
    const sub = await svc.create('user@example.com', 'owner/repo');
    await svc.delete(sub.id);
    const remaining = await svc.list({});
    expect(remaining).toHaveLength(0);
  });
});
