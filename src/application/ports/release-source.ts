import type { Release } from '../../domain/release';

export interface ReleaseSource {
  /** Fetches the latest release for the given repo. Throws RepoNotFoundError or RateLimitedError. */
  latestRelease(owner: string, repo: string): Promise<Release>;
  /** Validates the repo exists. Throws RepoNotFoundError. */
  repoExists(owner: string, repo: string): Promise<void>;
}
