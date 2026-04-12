import type { AxiosInstance } from 'axios';
import { RateLimitedError, RepoNotFoundError } from '../../domain/errors';
import type { Release } from '../../domain/release';
import type { ReleaseSource } from '../../application/ports/release-source';

interface GithubReleaseResponse {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
}

export class GithubReleaseSource implements ReleaseSource {
  constructor(
    private readonly http: AxiosInstance,
    private readonly token: string,
  ) {}

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async latestRelease(owner: string, repo: string): Promise<Release> {
    try {
      const response = await this.http.get<GithubReleaseResponse>(
        `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
        { headers: this.authHeaders },
      );
      const d = response.data;
      return {
        tag: d.tag_name,
        name: d.name,
        url: d.html_url,
        publishedAt: new Date(d.published_at),
      };
    } catch (err) {
      this.handleError(err, owner, repo);
    }
  }

  async repoExists(owner: string, repo: string): Promise<void> {
    try {
      await this.http.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: this.authHeaders,
      });
    } catch (err) {
      this.handleError(err, owner, repo);
    }
  }

  private handleError(err: unknown, owner: string, repo: string): never {
    if (isAxiosError(err)) {
      if (err.response?.status === 404) {
        throw new RepoNotFoundError(`${owner}/${repo}`);
      }
      if (err.response?.status === 403 || err.response?.status === 429) {
        const retryAfter = err.response.headers['retry-after'];
        throw new RateLimitedError(retryAfter ? parseInt(retryAfter, 10) : undefined);
      }
    }
    throw err;
  }
}

function isAxiosError(err: unknown): err is {
  response?: { status: number; headers: Record<string, string | undefined> };
} {
  return typeof err === 'object' && err !== null && 'response' in err;
}
