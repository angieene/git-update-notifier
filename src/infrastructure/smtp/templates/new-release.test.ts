import { describe, expect, it } from 'vitest';
import { renderBody, renderSubject } from './new-release';

const repo = {
  id: 1,
  owner: 'golang',
  name: 'go',
  lastSeenTag: null,
  lastCheckedAt: null,
};

const release = {
  tag: 'v1.22.0',
  name: 'Go 1.22.0',
  url: 'https://github.com/golang/go/releases/tag/v1.22.0',
  publishedAt: new Date('2024-02-06T00:00:00Z'),
};

const templateData = {
  repo,
  release,
  unsubscribeToken: 'abc123',
  appBaseUrl: 'http://localhost:3000',
};

describe('renderSubject', () => {
  it('formats owner/name and tag', () => {
    expect(renderSubject(templateData)).toBe('New release: golang/go v1.22.0');
  });
});

describe('renderBody', () => {
  it('includes repo owner/name', () => {
    expect(renderBody(templateData)).toContain('golang/go');
  });

  it('includes tag, name, url, and publishedAt', () => {
    const body = renderBody(templateData);
    expect(body).toContain('v1.22.0');
    expect(body).toContain('Go 1.22.0');
    expect(body).toContain('https://github.com/golang/go/releases/tag/v1.22.0');
    expect(body).toContain('2024-02-06T00:00:00.000Z');
  });

  it('includes unsubscribe link', () => {
    const body = renderBody(templateData);
    expect(body).toContain('http://localhost:3000/api/unsubscribe/abc123');
  });
});
