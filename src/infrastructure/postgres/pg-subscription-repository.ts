import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { SubscriberInfo, SubscriptionRepository, SubscriptionWithRepo } from '../../application/ports/subscription-repository';
import { SubscriptionExistsError, SubscriptionNotFoundError, TokenNotFoundError } from '../../domain/errors';
import type { ListFilter } from '../../domain/list-filter';
import type { NewSubscription, Subscription } from '../../domain/subscription';
import type { TrackedRepo } from '../../domain/tracked-repo';

// ---------------------------------------------------------------------------
// Row types (snake_case columns from Postgres)
// ---------------------------------------------------------------------------

interface SubscriptionRow {
  id: string;
  email: string;
  repo_id: number;
  created_at: Date;
  confirmation_token: string | null;
  confirmed_at: Date | null;
  unsubscribe_token: string | null;
}

interface RepoRow {
  id: number;
  owner: string;
  name: string;
  last_seen_tag: string | null;
  last_checked_at: Date | null;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    email: row.email,
    repositoryId: row.repo_id,
    createdAt: row.created_at,
    confirmationToken: row.confirmation_token,
    confirmedAt: row.confirmed_at,
    unsubscribeToken: row.unsubscribe_token,
  };
}

function rowToTrackedRepo(row: RepoRow): TrackedRepo {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    lastSeenTag: row.last_seen_tag,
    lastCheckedAt: row.last_checked_at,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && (err as { code?: string }).code === '23505';
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PgSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly pool: Pool) {}

  async create(sub: NewSubscription): Promise<Subscription> {
    try {
      const { rows } = await this.pool.query<SubscriptionRow>(
        `INSERT INTO subscriptions (id, email, repo_id, confirmation_token, unsubscribe_token)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, repo_id, created_at, confirmation_token, confirmed_at, unsubscribe_token`,
        [randomUUID(), sub.email, sub.repositoryId, sub.confirmationToken, sub.unsubscribeToken],
      );
      return rowToSubscription(rows[0]!);
    } catch (err) {
      if (isUniqueViolation(err)) throw new SubscriptionExistsError('already subscribed');
      throw err;
    }
  }

  async list(filter: ListFilter): Promise<Subscription[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.email) {
      params.push(filter.email);
      conditions.push(`email = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query = `SELECT id, email, repo_id, created_at, confirmation_token, confirmed_at, unsubscribe_token
                 FROM subscriptions
                 ${where}
                 ORDER BY created_at DESC`;

    if (filter.limit !== undefined) {
      params.push(filter.limit);
      query += ` LIMIT $${params.length}`;
    }
    if (filter.offset !== undefined) {
      params.push(filter.offset);
      query += ` OFFSET $${params.length}`;
    }

    const { rows } = await this.pool.query<SubscriptionRow>(query, params);
    return rows.map(rowToSubscription);
  }

  async listWithRepo(filter: ListFilter): Promise<SubscriptionWithRepo[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.email) {
      params.push(filter.email);
      conditions.push(`s.email = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query = `SELECT s.id, s.email, s.repo_id, s.created_at, s.confirmation_token, s.confirmed_at, s.unsubscribe_token, r.owner, r.name, r.last_seen_tag
                 FROM subscriptions s
                 JOIN tracked_repos r ON r.id = s.repo_id
                 ${where}
                 ORDER BY s.created_at DESC`;

    if (filter.limit !== undefined) {
      params.push(filter.limit);
      query += ` LIMIT $${params.length}`;
    }
    if (filter.offset !== undefined) {
      params.push(filter.offset);
      query += ` OFFSET $${params.length}`;
    }

    const { rows } = await this.pool.query<SubscriptionRow & { owner: string; name: string; last_seen_tag: string | null }>(query, params);
    return rows.map((row) => ({
      subscription: rowToSubscription(row),
      owner: row.owner as string,
      name: row.name as string,
      lastSeenTag: row.last_seen_tag,
    }));
  }

  async delete(id: string): Promise<void> {
    const { rowCount } = await this.pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);
    if (!rowCount) throw new SubscriptionNotFoundError(`subscription not found: ${id}`);
  }

  async upsertRepo(owner: string, name: string, initialTag: string | null): Promise<TrackedRepo> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const repo = await this.upsertRepoWithClient(client, owner, name, initialTag);
      await client.query('COMMIT');
      return repo;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async upsertRepoWithClient(
    client: import('pg').PoolClient,
    owner: string,
    name: string,
    initialTag: string | null,
  ): Promise<TrackedRepo> {
    // ON CONFLICT DO NOTHING preserves an existing row's last_seen_tag
    await client.query(
      `INSERT INTO tracked_repos (owner, name, last_seen_tag)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner, name) DO NOTHING`,
      [owner, name, initialTag],
    );
    const { rows } = await client.query<RepoRow>(
      `SELECT id, owner, name, last_seen_tag, last_checked_at
       FROM tracked_repos WHERE owner = $1 AND name = $2`,
      [owner, name],
    );
    return rowToTrackedRepo(rows[0]!);
  }

  async listActiveRepos(): Promise<TrackedRepo[]> {
    const { rows } = await this.pool.query<RepoRow>(
      `SELECT DISTINCT r.id, r.owner, r.name, r.last_seen_tag, r.last_checked_at
       FROM tracked_repos r
       JOIN subscriptions s ON s.repo_id = r.id
       WHERE s.confirmed_at IS NOT NULL`,
    );
    return rows.map(rowToTrackedRepo);
  }

  async advanceLastSeen(repoId: number, tag: string): Promise<void> {
    await this.pool.query(
      `UPDATE tracked_repos
       SET last_seen_tag = $2, last_checked_at = now()
       WHERE id = $1`,
      [repoId, tag],
    );
  }

  async listSubscribersForRepo(repoId: number): Promise<SubscriberInfo[]> {
    const { rows } = await this.pool.query<{ email: string; unsubscribe_token: string }>(
      `SELECT email, unsubscribe_token
       FROM subscriptions
       WHERE repo_id = $1 AND confirmed_at IS NOT NULL`,
      [repoId],
    );
    return rows.map((r) => ({ email: r.email, unsubscribeToken: r.unsubscribe_token }));
  }

  async confirmByToken(token: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `UPDATE subscriptions
       SET confirmed_at = NOW()
       WHERE confirmation_token = $1 AND confirmed_at IS NULL`,
      [token],
    );
    if (!rowCount) throw new TokenNotFoundError('invalid or already used confirmation token');
  }

  async deleteByUnsubscribeToken(token: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM subscriptions WHERE unsubscribe_token = $1`,
      [token],
    );
    if (!rowCount) throw new TokenNotFoundError('invalid unsubscribe token');
  }

  async createSubscriptionWithRepo(
    email: string,
    owner: string,
    name: string,
    initialTag: string | null,
    confirmationToken: string,
    unsubscribeToken: string,
  ): Promise<{ subscription: Subscription; repo: TrackedRepo }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const repo = await this.upsertRepoWithClient(client, owner, name, initialTag);

      // Insert subscription with tokens
      const { rows: subRows } = await client.query<SubscriptionRow>(
        `INSERT INTO subscriptions (id, email, repo_id, confirmation_token, unsubscribe_token)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, repo_id, created_at, confirmation_token, confirmed_at, unsubscribe_token`,
        [randomUUID(), email, repo.id, confirmationToken, unsubscribeToken],
      );
      const subscription = rowToSubscription(subRows[0]!);

      await client.query('COMMIT');
      return { subscription, repo };
    } catch (err) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(err)) throw new SubscriptionExistsError('already subscribed');
      throw err;
    } finally {
      client.release();
    }
  }
}
