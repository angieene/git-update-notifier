import * as fs from 'fs';
import * as path from 'path';
import type { Pool } from 'pg';

// Arbitrary but stable lock key — prevents two instances racing on startup.
const ADVISORY_LOCK_KEY = 8675309;

export async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Hold a session-level advisory lock for the duration of migration.
    // Only one instance proceeds; others block until the lock is released.
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    const appliedSet = new Set(rows.map((r) => r.version));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    // Advisory lock is released automatically when the connection is returned to
    // the pool (session ends), but release explicitly for clarity.
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    client.release();
  }
}

// Allow running directly: tsx src/infrastructure/postgres/migrations.ts
if (require.main === module) {
  const { Pool } = require('pg') as typeof import('pg');
  const { loadConfig } = require('../../config') as typeof import('../../config');

  const cfg = loadConfig();
  const pool = new Pool({ connectionString: cfg.databaseUrl });
  const dir = path.resolve(process.cwd(), 'migrations');

  runMigrations(pool, dir)
    .then(() => {
      console.log('migrations complete');
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
