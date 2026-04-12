export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidFormatError extends DomainError {
  readonly code = 'invalid_format';
}

export class RepoNotFoundError extends DomainError {
  readonly code = 'repository_not_found';
  constructor(public readonly ownerRepo: string) {
    super(`repository not found: ${ownerRepo}`);
  }
}

export class SubscriptionNotFoundError extends DomainError {
  readonly code = 'subscription_not_found';
}

export class SubscriptionExistsError extends DomainError {
  readonly code = 'subscription_exists';
}

export class RateLimitedError extends DomainError {
  readonly code = 'upstream_rate_limited';
  constructor(public readonly retryAfterSeconds?: number) {
    super('upstream rate limited');
  }
}

export class UpstreamUnavailableError extends DomainError {
  readonly code = 'upstream_unavailable';
}
