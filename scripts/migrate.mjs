/**
 * Apply the SQL migrations to a Postgres database.
 *
 * This exists so that setting up Supabase never depends on finding a
 * particular button in the dashboard. Everything in supabase/migrations/ is
 * written to be safe to run repeatedly (`if not exists` throughout), so
 * re-running this is harmless.
 *
 *   npm run migrate
 *
 * It reads DATABASE_URL from .env.local, or from the environment. Get the
 * value from your Supabase project under Project Settings -> Database ->
 * Connection string (URI), and replace [YOUR-PASSWORD] with the database
 * password you chose when creating the project.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

/**
 * Minimal .env parser. Avoids a dotenv dependency and works on any Node 18+,
 * unlike process.loadEnvFile which is newer.
 */
async function loadEnvFile(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }

  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip one layer of matching quotes, which people often paste in.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function explain(err, connectionString) {
  const host = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return '(unparseable host)';
    }
  })();

  switch (err.code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Could not resolve ${host}. Check the host in DATABASE_URL, and that you are online.`;
    case 'ECONNREFUSED':
      return `${host} refused the connection. Check the port - Supabase uses 5432 for a direct or session connection.`;
    case 'ETIMEDOUT':
      return `Timed out reaching ${host}. Some networks block outbound Postgres; try the session pooler connection string.`;
    case '28P01':
      return 'Password rejected. Replace [YOUR-PASSWORD] in DATABASE_URL with your database password (not the API keys).';
    case '3D000':
      return 'That database does not exist. The Supabase URI should end in /postgres.';
    default:
      return null;
  }
}

async function main() {
  const fileEnv = await loadEnvFile(path.join(process.cwd(), '.env.local'));
  const connectionString = process.env.DATABASE_URL || fileEnv.DATABASE_URL;

  if (!connectionString) {
    console.error(
      [
        'DATABASE_URL is not set.',
        '',
        'Add it to .env.local:',
        '  DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.xxxxxxxx.supabase.co:5432/postgres',
        '',
        'In Supabase: Project Settings -> Database -> Connection string -> URI.',
        'Replace [YOUR-PASSWORD] with the database password you set when you',
        'created the project. This is NOT the anon or service_role key.',
      ].join('\n')
    );
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.error(`No .sql files found in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  // Supabase requires TLS. The managed certificate is not in Node's trust
  // store, and this script only ever runs against a database the user already
  // holds the password for, so verification is not what protects it here.
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    console.error('Could not connect.\n');
    const hint = explain(err, connectionString);
    console.error(hint ? `  ${hint}` : `  ${err.message}`);
    process.exit(1);
  }

  console.log(`Connected. Applying ${files.length} migration file(s).\n`);

  try {
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  ${file} ... `);
      // One transaction per file, so a failure leaves nothing half-applied.
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('commit');
        console.log('ok');
      } catch (err) {
        await client.query('rollback');
        console.log('failed');
        throw err;
      }
    }
  } catch (err) {
    console.error(`\n${err.message}`);
    if (err.position) console.error(`  at character ${err.position}`);
    await client.end();
    process.exit(1);
  }

  const { rows } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`
  );
  console.log(`\nDone. Tables in public: ${rows.map((r) => r.table_name).join(', ')}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
