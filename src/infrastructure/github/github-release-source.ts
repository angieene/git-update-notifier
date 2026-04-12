import type { AxiosInstance, AxiosResponse } from 'axios';
import { RateLimitedError, RepoNotFoundError, UpstreamUnavailableError } from '../../domain/errors';
import type { Release } from '../../domain/release';
import type { ReleaseSource } from '../../application/ports/release-source';
import type { Logger } from '../logger';

interface GithubReleaseResponse {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
}

export class GithubReleaseSource implements ReleaseSource {
  constructor(
    private readonly http: AxiosInstance,
    private readonly logger: Logger,
  ) {}

  async latestRelease(owner: string, repo: string): Promise<Release> {
    const url = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
    const res = await this.http.get<GithubReleaseResponse>(url);

    this.throwIfRateLimited(res);

    if (res.status === 404) {
      // Repo exists but has no releases yet — return empty-tag sentinel
      return { tag: '', name: '', url: '', publishedAt: new Date(0) };
    }
    if (res.status !== 200) {
      throw new UpstreamUnavailableError(`github returned ${res.status}`);
    }

    return {
      tag: res.data.tag_name,
      name: res.data.name ?? res.data.tag_name,
      url: res.data.html_url,
      publishedAt: new Date(res.data.published_at),
    };
  }

  async repoExists(owner: string, repo: string): Promise<void> {
    const url = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const res = await this.http.get(url);

    this.throwIfRateLimited(res);

    if (res.status === 404) {
      throw new RepoNotFoundError(`${owner}/${repo}`);
    }
    if (res.status !== 200) {
      throw new UpstreamUnavailableError(`github returned ${res.status}`);
    }
  }

  private throwIfRateLimited(res: AxiosResponse): void {
    const remaining = Number(res.headers['x-ratelimit-remaining']);
    const isRateLimit = (res.status === 403 || res.status === 429) && remaining === 0;

    if (!isRateLimit) return;

    const retryAfterHeader = res.headers['retry-after'] as string | undefined;
    const resetHeader = res.headers['x-ratelimit-reset'] as string | undefined;

    let retryAfterSeconds: number | undefined;
    if (retryAfterHeader) {
      retryAfterSeconds = Number(retryAfterHeader);
    } else if (resetHeader) {
      retryAfterSeconds = Math.max(0, Number(resetHeader) - Math.floor(Date.now() / 1000));
    }

    this.logger.warn({ retryAfterSeconds }, 'github rate limit hit');
    throw new RateLimitedError(retryAfterSeconds);
  }
}
