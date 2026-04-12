import type { ReleaseSource } from '../../application/ports/release-source';
import { RepoNotFoundError } from '../../domain/errors';
import type { Release } from '../../domain/release';

export class FakeReleaseSource implements ReleaseSource {
  private releases = new Map<string, Release>();
  private missingRepos = new Set<string>();

  setRelease(owner: string, repo: string, release: Release): void {
    this.releases.set(`${owner}/${repo}`, release);
  }

  setMissing(owner: string, repo: string): void {
    this.missingRepos.add(`${owner}/${repo}`);
  }

  async latestRelease(owner: string, repo: string): Promise<Release> {
    const key = `${owner}/${repo}`;
    if (this.missingRepos.has(key)) throw new RepoNotFoundError(key);
    const release = this.releases.get(key);
    if (!release) throw new RepoNotFoundError(key);
    return release;
  }

  async repoExists(owner: string, repo: string): Promise<void> {
    const key = `${owner}/${repo}`;
    if (this.missingRepos.has(key)) throw new RepoNotFoundError(key);
    if (!this.releases.has(key)) throw new RepoNotFoundError(key);
  }
}
