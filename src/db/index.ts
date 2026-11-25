import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { eq, asc } from "drizzle-orm";
import * as schema from "./schema";

const DEFAULT_DB_URL = "file:./data/local.db";

function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL?.trim() || DEFAULT_DB_URL;
  if (url === DEFAULT_DB_URL) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
  return url;
}

let clientSingleton: Client | null = null;
let dbSingleton: LibSQLDatabase<typeof schema> | null = null;
let initPromise: Promise<void> | null = null;

export function getDbClient(): Client {
  if (!clientSingleton) {
    clientSingleton = createClient({
      url: resolveDbUrl(),
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
    });
  }
  return clientSingleton;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  if (!dbSingleton) {
    dbSingleton = drizzle(getDbClient(), { schema });
  }
  return dbSingleton;
}

const DEFAULT_SPACES: Array<typeof schema.spaces.$inferInsert> = [
  {
    id: "tasks",
    userId: "owner",
    name: "Yapılacaklar",
    kind: "tasks",
    description:
      "Görevler, yapılacak işler, toplantılar, hatırlatmalar ve eylem adımları.",
    icon: "check-square",
    position: 0,
    isSystem: true,
    createdAt: Date.now(),
  },
  {
    id: "resources",
    userId: "owner",
    name: "Araçlar & Kaynaklar",
    kind: "resources",
    description:
      "Yazılım araçları, SaaS ürünleri, kütüphaneler, linkler, kavramlar ve araştırma kaynakları.",
    icon: "wrench",
    position: 1,
    isSystem: true,
    createdAt: Date.now(),
  },
  {
    id: "ideas",
    userId: "owner",
    name: "Fikirler",
    kind: "ideas",
    description:
      "Ürün fikirleri, beyin fırtınası notları, stratejiler ve serbest düşünceler.",
    icon: "lightbulb",
    position: 2,
    isSystem: true,
    createdAt: Date.now(),
  },
];

export async function ensureDbReady(): Promise<LibSQLDatabase<typeof schema>> {
  const db = getDb();
  if (!initPromise) {
    initPromise = (async () => {
      const client = getDbClient();
      await client.executeMultiple(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'owner',
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT 'emerald',
          position INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS spaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'owner',
          name TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'custom',
          description TEXT NOT NULL DEFAULT '',
          icon TEXT NOT NULL DEFAULT 'folder',
          position INTEGER NOT NULL DEFAULT 0,
          is_system INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'owner',
          project_id TEXT NOT NULL DEFAULT 'default',
          parent_id TEXT,
          space_id TEXT NOT NULL,
          raw_text TEXT NOT NULL,
          input_type TEXT NOT NULL DEFAULT 'text',
          status TEXT NOT NULL DEFAULT 'processing',
          title TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          suggested_space TEXT,
          provider_used TEXT NOT NULL DEFAULT 'gemini',
          used_byok INTEGER NOT NULL DEFAULT 0,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          cost_usd REAL NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_notes_space_created
          ON notes (space_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS app_settings (
          id TEXT PRIMARY KEY,
          user_context TEXT NOT NULL DEFAULT '',
          active_provider TEXT NOT NULL DEFAULT 'gemini',
          prefer_byok INTEGER NOT NULL DEFAULT 1,
          encrypted_gemini_key TEXT NOT NULL DEFAULT '',
          encrypted_openai_key TEXT NOT NULL DEFAULT '',
          monthly_system_budget_usd REAL NOT NULL DEFAULT 2.0,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entity_cache (
          normalized_key TEXT PRIMARY KEY,
          research_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Safe migration for existing local.db without project_id / parent_id
      try {
        await client.execute(
          `ALTER TABLE notes ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default'`
        );
      } catch {
        // Column already exists
      }
      try {
        await client.execute(`ALTER TABLE notes ADD COLUMN parent_id TEXT`);
      } catch {
        // Column already exists
      }
      await client.execute(
        `CREATE INDEX IF NOT EXISTS idx_notes_project_created ON notes (project_id, created_at DESC)`
      );
      await client.execute(
        `CREATE INDEX IF NOT EXISTS idx_notes_parent_created ON notes (parent_id, created_at ASC)`
      );

      const existingProjects = await db
        .select()
        .from(schema.projects)
        .orderBy(asc(schema.projects.position));

      if (existingProjects.length === 0) {
        await db
          .insert(schema.projects)
          .values({
            id: "default",
            userId: "owner",
            name: "Genel Alan",
            description: "Günlük fikirler, hızlı görevler ve genel araç araştırmaları.",
            color: "emerald",
            position: 0,
            isDefault: true,
            createdAt: Date.now(),
          })
          .onConflictDoNothing();
      }

      const existingSpaces = await db
        .select()
        .from(schema.spaces)
        .orderBy(asc(schema.spaces.position));

      if (existingSpaces.length === 0) {
        const now = Date.now();
        for (const sp of DEFAULT_SPACES) {
          await db
            .insert(schema.spaces)
            .values({ ...sp, createdAt: now })
            .onConflictDoNothing();
        }
      }

      const existingSettings = await db
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.id, "owner"));

      if (existingSettings.length === 0) {
        const defaultBudget = Number(
          process.env.MONTHLY_SYSTEM_BUDGET_USD || "2.0"
        );
        await db
          .insert(schema.appSettings)
          .values({
            id: "owner",
            userContext: "",
            activeProvider: "gemini",
            preferByok: true,
            encryptedGeminiKey: "",
            encryptedOpenaiKey: "",
            monthlySystemBudgetUsd:
              Number.isFinite(defaultBudget) && defaultBudget > 0
                ? defaultBudget
                : 2.0,
            updatedAt: Date.now(),
          })
          .onConflictDoNothing();
      }
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
  return db;
}
