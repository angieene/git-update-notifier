import type { Pool } from 'pg';
import type { SubscriptionRepository } from '../../application/ports/subscription-repository';
import type { ListFilter } from '../../domain/list-filter';
import type { NewSubscription, Subscription } from '../../domain/subscription';
import type { TrackedRepo } from '../../domain/tracked-repo';

export class PgSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly pool: Pool) {}

  async create(sub: NewSubscription): Promise<Subscription> {
    const result = await this.pool.query<{
      id: string;
      email: string;
      repo_id: number;
      created_at: Date;
    }>(
      `INSERT INTO subscriptions (email, repo_id)
       VALUES ($1, $2)
       RETURNING id, email, repo_id, created_at`,
      [sub.email, sub.repositoryId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('insert returned no row');
    return { id: row.id, email: row.email, repositoryId: row.repo_id, createdAt: row.created_at };
  }

  async list(filter: ListFilter): Promise<Subscription[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.email) {
      params.push(filter.email);
      conditions.push(`email = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query = `SELECT id, email, repo_id, created_at
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

    const result = await this.pool.query<{
      id: string;
      email: string;
      repo_id: number;
      created_at: Date;
    }>(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      repositoryId: row.repo_id,
      createdAt: row.created_at,
    }));
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);
  }

  async upsertRepo(owner: string, name: string, initialTag: string | null): Promise<TrackedRepo> {
    const result = await this.pool.query<{
      id: number;
      owner: string;
      name: string;
      last_seen_tag: string | null;
      last_checked_at: Date | null;
    }>(
      `INSERT INTO tracked_repos (owner, name, last_seen_tag)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner, name) DO UPDATE
         SET last_seen_tag = COALESCE(tracked_repos.last_seen_tag, EXCLUDED.last_seen_tag)
       RETURNING id, owner, name, last_seen_tag, last_checked_at`,
      [owner, name, initialTag],
    );
    const row = result.rows[0];
    if (!row) throw new Error('upsert returned no row');
    return {
      id: row.id,
      owner: row.owner,
      name: row.name,
      lastSeenTag: row.last_seen_tag,
      lastCheckedAt: row.last_checked_at,
    };
  }

  async listActiveRepos(): Promise<TrackedRepo[]> {
    const result = await this.pool.query<{
      id: number;
      owner: string;
      name: string;
      last_seen_tag: string | null;
      last_checked_at: Date | null;
    }>(
      `SELECT r.id, r.owner, r.name, r.last_seen_tag, r.last_checked_at
       FROM tracked_repos r
       WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.repo_id = r.id)
       ORDER BY r.id`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      owner: row.owner,
      name: row.name,
      lastSeenTag: row.last_seen_tag,
      lastCheckedAt: row.last_checked_at,
    }));
  }

  async advanceLastSeen(repoId: number, tag: string): Promise<void> {
    await this.pool.query(
      `UPDATE tracked_repos SET last_seen_tag = $1, last_checked_at = NOW() WHERE id = $2`,
      [tag, repoId],
    );
  }

  async listSubscribersForRepo(repoId: number): Promise<string[]> {
    const result = await this.pool.query<{ email: string }>(
      `SELECT email FROM subscriptions WHERE repo_id = $1`,
      [repoId],
    );
    return result.rows.map((r) => r.email);
  }
}
