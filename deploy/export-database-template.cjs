// Exports structure and public catalogs only. Never exports accounts or transactions.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('../api/node_modules/pg');
require('../api/node_modules/dotenv').config({ path: path.join(__dirname, '../api/.env'), quiet: true });

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Esta exportación de plantilla está limitada a la base local.');
  }
  const output = path.join(__dirname, 'db');
  fs.mkdirSync(output, { recursive: true });
  const pgDump = process.env.PG_DUMP_PATH || (process.platform === 'win32'
    ? 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe' : 'pg_dump');
  const schema = execFileSync(pgDump, ['--schema-only', '--no-owner', '--no-acl', '--no-publications', '--no-subscriptions'], {
    env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'disable' },
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  fs.writeFileSync(path.join(output, '001-schema.sql'), schema.replace(/\r\n/g, '\n'));
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const catalogs = [
      ['plans', "SELECT * FROM plans WHERE code IN ('FREE', 'PRO') ORDER BY code"],
      ['categories', 'SELECT * FROM categories WHERE is_system = TRUE AND user_id IS NULL ORDER BY id'],
    ];
    let sql = '-- Public application catalogs only. No users, credentials or financial records.\nBEGIN;\n';
    for (const [table, query] of catalogs) {
      const { rows } = await db.query(query);
      if (!rows.length) continue;
      const json = JSON.stringify(rows).replace(/'/g, "''");
      sql += `INSERT INTO public.${table} SELECT * FROM json_populate_recordset(NULL::public.${table}, '${json}'::json) ON CONFLICT DO NOTHING;\n`;
    }
    sql += 'COMMIT;\n';
    fs.writeFileSync(path.join(output, '002-catalogs.sql'), sql);
    console.log('Exported schema and public catalogs. No user data exported.');
  } finally { await db.end(); }
}
main().catch(() => { console.error('No se pudo exportar la plantilla. Revisa la conexión local y PG_DUMP_PATH.'); process.exitCode = 1; });
