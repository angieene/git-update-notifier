import type { Release } from '../../../domain/release';
import type { TrackedRepo } from '../../../domain/tracked-repo';

export interface TemplateData {
  repo: TrackedRepo;
  release: Release;
  unsubscribeToken: string;
  appBaseUrl: string;
}

export function renderSubject({ repo, release }: TemplateData): string {
  return `New release: ${repo.owner}/${repo.name} ${release.tag}`;
}

export function renderBody({ repo, release, unsubscribeToken, appBaseUrl }: TemplateData): string {
  const unsubscribeUrl = `${appBaseUrl}/api/unsubscribe/${unsubscribeToken}`;
  return [
    `A new release of ${repo.owner}/${repo.name} is available:`,
    ``,
    `Version: ${release.tag}`,
    `Name: ${release.name}`,
    `Published: ${release.publishedAt.toISOString()}`,
    `URL: ${release.url}`,
    ``,
    `You are receiving this because you subscribed to release updates.`,
    `To unsubscribe, visit: ${unsubscribeUrl}`,
  ].join('\n');
}
