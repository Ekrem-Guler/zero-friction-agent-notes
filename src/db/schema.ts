import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export type SpaceKind = "tasks" | "resources" | "ideas" | "custom";
export type NoteInputType = "text" | "voice";
export type NoteStatus = "processing" | "completed" | "error";
export type AIProviderName = "gemini" | "openai" | "huggingface";

export interface SubtaskItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteMetadata {
  isCompleted?: boolean;
  showRawOnly?: boolean;
  promotedToSpace?: boolean;
  dueDate?: string | null;
  priority?: "low" | "medium" | "high" | null;
  subtasks?: SubtaskItem[];
  categoryTag?: string | null;
  officialUrl?: string | null;
  pricingHint?: string | null;
  projectUseCase?: string | null;
  nextStep?: string | null;
  tags?: string[];
  errorMessage?: string | null;
}

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("emerald"),
  position: integer("position").notNull().default(0),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  name: text("name").notNull(),
  kind: text("kind").$type<SpaceKind>().notNull().default("custom"),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("folder"),
  position: integer("position").notNull().default(0),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  projectId: text("project_id").notNull().default("default"),
  parentId: text("parent_id"),
  spaceId: text("space_id").notNull(),
  rawText: text("raw_text").notNull(),
  inputType: text("input_type").$type<NoteInputType>().notNull().default("text"),
  status: text("status").$type<NoteStatus>().notNull().default("processing"),
  title: text("title").notNull().default(""),
  summary: text("summary").notNull().default(""),
  metadataJson: text("metadata_json").notNull().default("{}"),
  suggestedSpace: text("suggested_space"),
  providerUsed: text("provider_used").notNull().default("gemini"),
  usedByok: integer("used_byok", { mode: "boolean" }).notNull().default(false),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey(), // 'owner' in Phase 1, userId in Phase 2
  userContext: text("user_context").notNull().default(""),
  activeProvider: text("active_provider")
    .$type<AIProviderName>()
    .notNull()
    .default("gemini"),
  preferByok: integer("prefer_byok", { mode: "boolean" })
    .notNull()
    .default(true),
  encryptedGeminiKey: text("encrypted_gemini_key").notNull().default(""),
  encryptedOpenaiKey: text("encrypted_openai_key").notNull().default(""),
  encryptedHfKey: text("encrypted_hf_key").notNull().default(""),
  hfModel: text("hf_model").notNull().default("Qwen/Qwen2.5-7B-Instruct"),
  monthlySystemBudgetUsd: real("monthly_system_budget_usd")
    .notNull()
    .default(2.0),
  updatedAt: integer("updated_at").notNull(),
});

export const entityCache = sqliteTable("entity_cache", {
  normalizedKey: text("normalized_key").primaryKey(),
  researchJson: text("research_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type SpaceRow = typeof spaces.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type AppSettingsRow = typeof appSettings.$inferSelect;
