import type { Redis } from 'ioredis';
import type { ReleaseSource } from '../../application/ports/release-source';
import type { Release } from '../../domain/release';

export class CachedReleaseSource implements ReleaseSource {
  constructor(
    private readonly inner: ReleaseSource,
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  async latestRelease(owner: string, repo: string): Promise<Release> {
    const key = `release:${owner}/${repo}`;
    const cached = await this.redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as Omit<Release, 'publishedAt'> & { publishedAt: string };
      return { ...parsed, publishedAt: new Date(parsed.publishedAt) };
    }
    const release = await this.inner.latestRelease(owner, repo);
    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(release));
    return release;
  }

  async repoExists(owner: string, repo: string): Promise<void> {
    return this.inner.repoExists(owner, repo);
  }
}
