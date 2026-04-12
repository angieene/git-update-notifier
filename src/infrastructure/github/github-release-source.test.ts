import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { AxiosInstance } from 'axios';
import pino from 'pino';
import { RateLimitedError, RepoNotFoundError, UpstreamUnavailableError } from '../../domain/errors';
import { GithubReleaseSource } from './github-release-source';

const testLogger = pino({ level: 'silent' });

describe('GithubReleaseSource', () => {
  let mockHttp: AxiosInstance;
  let source: GithubReleaseSource;

  beforeEach(() => {
    mockHttp = { get: vi.fn() } as unknown as AxiosInstance;
    source = new GithubReleaseSource(mockHttp, testLogger);
  });

  describe('latestRelease', () => {
    it('returns a Release on 200', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 200,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {
          tag_name: 'v1.2.3',
          name: 'Release 1.2.3',
          html_url: 'https://github.com/acme/widget/releases/tag/v1.2.3',
          published_at: '2024-01-01T00:00:00Z',
        },
      });

      const release = await source.latestRelease('acme', 'widget');

      expect(release.tag).toBe('v1.2.3');
      expect(release.name).toBe('Release 1.2.3');
      expect(release.url).toBe('https://github.com/acme/widget/releases/tag/v1.2.3');
      expect(release.publishedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('falls back to tag_name when name is null', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 200,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {
          tag_name: 'v1.2.3',
          name: null,
          html_url: 'https://github.com/acme/widget/releases/tag/v1.2.3',
          published_at: '2024-01-01T00:00:00Z',
        },
      });

      const release = await source.latestRelease('acme', 'widget');

      expect(release.name).toBe('v1.2.3');
    });

    it('returns empty-tag sentinel on 404 (repo exists, no releases yet)', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 404,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {},
      });

      const release = await source.latestRelease('acme', 'widget');

      expect(release.tag).toBe('');
      expect(release.url).toBe('');
      expect(release.publishedAt).toEqual(new Date(0));
    });

    it('throws RateLimitedError on 403 with remaining=0, computes retryAfter from reset header', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60;
      (mockHttp.get as Mock).mockResolvedValue({
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetTime),
        },
        data: {},
      });

      const err = await source.latestRelease('acme', 'widget').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RateLimitedError);
      expect((err as RateLimitedError).retryAfterSeconds).toBeGreaterThan(0);
    });

    it('throws RateLimitedError on 429 with remaining=0, prefers Retry-After header', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 429,
        headers: {
          'x-ratelimit-remaining': '0',
          'retry-after': '30',
        },
        data: {},
      });

      const err = await source.latestRelease('acme', 'widget').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RateLimitedError);
      expect((err as RateLimitedError).retryAfterSeconds).toBe(30);
    });

    it('does not throw RateLimitedError on 403 when remaining > 0', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 403,
        headers: { 'x-ratelimit-remaining': '10' },
        data: {},
      });

      await expect(source.latestRelease('acme', 'widget')).rejects.toBeInstanceOf(UpstreamUnavailableError);
    });

    it('throws UpstreamUnavailableError on unexpected non-200 status', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 500,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {},
      });

      await expect(source.latestRelease('acme', 'widget')).rejects.toBeInstanceOf(UpstreamUnavailableError);
    });

    it('URL-encodes owner and repo', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 200,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {
          tag_name: 'v1.0',
          name: 'v1.0',
          html_url: 'https://github.com/my%20org/my%20repo/releases/tag/v1.0',
          published_at: '2024-01-01T00:00:00Z',
        },
      });

      await source.latestRelease('my org', 'my repo');

      expect(mockHttp.get).toHaveBeenCalledWith('/repos/my%20org/my%20repo/releases/latest');
    });
  });

  describe('repoExists', () => {
    it('resolves without error on 200', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 200,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {},
      });

      await expect(source.repoExists('acme', 'widget')).resolves.toBeUndefined();
    });

    it('throws RepoNotFoundError on 404', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 404,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {},
      });

      const err = await source.repoExists('acme', 'widget').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RepoNotFoundError);
      expect((err as RepoNotFoundError).ownerRepo).toBe('acme/widget');
    });

    it('throws RateLimitedError on 429 with remaining=0', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 429,
        headers: { 'x-ratelimit-remaining': '0', 'retry-after': '60' },
        data: {},
      });

      const err = await source.repoExists('acme', 'widget').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RateLimitedError);
      expect((err as RateLimitedError).retryAfterSeconds).toBe(60);
    });

    it('throws UpstreamUnavailableError on non-200/404 status', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 503,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {},
      });

      await expect(source.repoExists('acme', 'widget')).rejects.toBeInstanceOf(UpstreamUnavailableError);
    });

    it('URL-encodes owner and repo', async () => {
      (mockHttp.get as Mock).mockResolvedValue({
        status: 200,
        headers: { 'x-ratelimit-remaining': '59' },
        data: {},
      });

      await source.repoExists('my org', 'my repo');

      expect(mockHttp.get).toHaveBeenCalledWith('/repos/my%20org/my%20repo');
    });
  });
});
