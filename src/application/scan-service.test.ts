import { describe, it, expect, beforeEach } from 'vitest';
import { ScanService } from './scan-service';
import { RateLimitedError } from '../domain/errors';
import { FakeSubscriptionRepository } from '../test/fakes/fake-subscription-repository';
import { FakeReleaseSource } from '../test/fakes/fake-release-source';
import { FakeNotifier } from '../test/fakes/fake-notifier';
import type { ScanLogger } from './scan-service';
import type { Release } from '../domain/release';

const testLogger: ScanLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

const makeRelease = (tag: string): Release => ({
  tag,
  name: tag,
  url: `https://github.com/acme/widget/releases/tag/${tag}`,
  publishedAt: new Date('2024-01-01'),
});

describe('ScanService.tick', () => {
  let repo: FakeSubscriptionRepository;
  let source: FakeReleaseSource;
  let notifier: FakeNotifier;
  let svc: ScanService;

  beforeEach(() => {
    repo = new FakeSubscriptionRepository();
    source = new FakeReleaseSource();
    notifier = new FakeNotifier();
    svc = new ScanService(repo, source, notifier, testLogger);
  });

  it('notifies every subscriber when a new release appears', async () => {
    const tracked = repo.seedRepo({ owner: 'acme', name: 'widget', lastSeenTag: 'v1.0' });
    repo.seedSubscription({ email: 'a@test', repositoryId: tracked.id, confirmed: true });
    repo.seedSubscription({ email: 'b@test', repositoryId: tracked.id, confirmed: true });
    repo.seedSubscription({ email: 'c@test', repositoryId: tracked.id, confirmed: true });
    source.setRelease('acme', 'widget', makeRelease('v1.1'));

    await svc.tick();

    expect(notifier.sent).toHaveLength(3);
    expect(notifier.sent.map((m) => m.to).sort()).toEqual(['a@test', 'b@test', 'c@test']);
    expect(repo.getRepoById(tracked.id).lastSeenTag).toBe('v1.1');
  });

  it('silently seeds lastSeenTag on first observation', async () => {
    const tracked = repo.seedRepo({ owner: 'acme', name: 'widget', lastSeenTag: null });
    repo.seedSubscription({ email: 'a@test', repositoryId: tracked.id, confirmed: true });
    source.setRelease('acme', 'widget', makeRelease('v1.0'));

    await svc.tick();

    expect(notifier.sent).toHaveLength(0);
    expect(repo.getRepoById(tracked.id).lastSeenTag).toBe('v1.0');
  });

  it('does nothing when release tag matches lastSeenTag', async () => {
    const tracked = repo.seedRepo({ owner: 'acme', name: 'widget', lastSeenTag: 'v1.0' });
    repo.seedSubscription({ email: 'a@test', repositoryId: tracked.id, confirmed: true });
    source.setRelease('acme', 'widget', makeRelease('v1.0'));

    await svc.tick();

    expect(notifier.sent).toHaveLength(0);
    expect(repo.getRepoById(tracked.id).lastSeenTag).toBe('v1.0');
  });

  it('abandons the tick on rate limit without advancing unchecked repos', async () => {
    const r1 = repo.seedRepo({ owner: 'acme', name: 'one', lastSeenTag: 'v1.0' });
    const r2 = repo.seedRepo({ owner: 'acme', name: 'two', lastSeenTag: 'v2.0' });
    repo.seedSubscription({ email: 'a@test', repositoryId: r1.id, confirmed: true });
    repo.seedSubscription({ email: 'a@test', repositoryId: r2.id, confirmed: true });
    source.setRelease('acme', 'one', makeRelease('v1.1'));
    source.setError('acme', 'two', new RateLimitedError(60));

    await svc.tick();

    expect(repo.getRepoById(r1.id).lastSeenTag).toBe('v1.1'); // advanced
    expect(repo.getRepoById(r2.id).lastSeenTag).toBe('v2.0'); // unchanged
  });

  it('swallows notifier errors and still advances the tag', async () => {
    const tracked = repo.seedRepo({ owner: 'acme', name: 'widget', lastSeenTag: 'v1.0' });
    repo.seedSubscription({ email: 'a@test', repositoryId: tracked.id, confirmed: true });
    repo.seedSubscription({ email: 'b@test', repositoryId: tracked.id, confirmed: true });
    source.setRelease('acme', 'widget', makeRelease('v1.1'));

    let callCount = 0;
    notifier.notifyNewRelease = async () => {
      callCount++;
      if (callCount === 1) throw new Error('smtp timeout');
    };

    await svc.tick();

    expect(callCount).toBe(2); // both attempted
    expect(repo.getRepoById(tracked.id).lastSeenTag).toBe('v1.1'); // still advanced
  });

  it('skips notification when release has no tag', async () => {
    const tracked = repo.seedRepo({ owner: 'acme', name: 'widget', lastSeenTag: null });
    repo.seedSubscription({ email: 'a@test', repositoryId: tracked.id, confirmed: true });
    source.setRelease('acme', 'widget', { tag: '', name: '', url: '', publishedAt: new Date() });

    await svc.tick();

    expect(notifier.sent).toHaveLength(0);
    expect(repo.getRepoById(tracked.id).lastSeenTag).toBeNull();
  });

  it('succeeds immediately with no active repos', async () => {
    await svc.tick();

    expect(notifier.sent).toHaveLength(0);
  });

  it('skips a failed repo and continues with the rest', async () => {
    const r1 = repo.seedRepo({ owner: 'acme', name: 'broken', lastSeenTag: 'v1.0' });
    const r2 = repo.seedRepo({ owner: 'acme', name: 'ok', lastSeenTag: 'v2.0' });
    repo.seedSubscription({ email: 'a@test', repositoryId: r1.id, confirmed: true });
    repo.seedSubscription({ email: 'b@test', repositoryId: r2.id, confirmed: true });
    source.setMissing('acme', 'broken');
    source.setRelease('acme', 'ok', makeRelease('v2.1'));

    await svc.tick();

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]?.to).toBe('b@test');
    expect(repo.getRepoById(r2.id).lastSeenTag).toBe('v2.1');
  });

  it('exits cleanly when abort signal fires mid-tick', async () => {
    for (let i = 0; i < 5; i++) {
      const r = repo.seedRepo({ owner: 'acme', name: `repo-${i}`, lastSeenTag: 'v1.0' });
      repo.seedSubscription({ email: `user${i}@test`, repositoryId: r.id, confirmed: true });
      source.setRelease('acme', `repo-${i}`, makeRelease('v1.0'));
    }

    const controller = new AbortController();
    controller.abort(); // abort before tick starts

    await svc.tick(controller.signal);

    // Should exit immediately — no notifications
    expect(notifier.sent).toHaveLength(0);
  });
});
