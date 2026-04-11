import { createClient, type Client } from "@libsql/client";
import { DEFAULT_PANTRY_STAPLES } from "../lib/pantry-staples";
import { SCHEMA_SQL } from "./schema";

let clientPromise: Promise<Client> | null = null;

async function init(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL ?? "file:meal-planner.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url, authToken });

  const schema = SCHEMA_SQL;
  // Split on semicolons followed by newline; libsql executeMultiple is fine for raw SQL.
  await client.executeMultiple(schema);

  // Idempotent migrations for columns added after initial table creation.
  // CREATE TABLE IF NOT EXISTS won't add new columns to an existing table.
  await ensureColumn(client, "inventory_items", "available_from", "TEXT");
  await ensureColumn(client, "pantry_items", "qty", "TEXT");

  // Seed pantry on first boot.
  const count = await client.execute("SELECT COUNT(*) as c FROM pantry_items");
  const c = Number(count.rows[0]?.c ?? 0);
  if (c === 0) {
    await client.batch(
      DEFAULT_PANTRY_STAPLES.map((it) => ({
        sql: "INSERT OR IGNORE INTO pantry_items (name, category) VALUES (?, ?)",
        args: [it.name, it.category],
      })),
      "write",
    );
  }

  return client;
}

async function ensureColumn(
  client: Client,
  table: string,
  column: string,
  type: string,
): Promise<void> {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((r) => (r as any).name === column);
  if (!exists) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export function getClient(): Promise<Client> {
  if (!clientPromise) clientPromise = init();
  return clientPromise;
}
