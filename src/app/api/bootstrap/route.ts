import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { appSettings, notes, projects, spaces } from "@/db/schema";
import { isAuthenticated, isPasswordProtectionEnabled } from "@/lib/auth";
import { decryptSecret, maskApiKey } from "@/lib/crypto";
import {
  FREE_MONTHLY_AI_LIMIT,
  getCurrentMonthFreeUsage,
} from "@/lib/ai-agent";
import {
  serializeNote,
  serializeProject,
  serializeSpace,
  type ClientSettings,
  type UsageStats,
} from "@/lib/serializers";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await ensureDbReady();

  // Watchdog: recover any note stuck in "processing" for > 45 seconds
  const staleCutoff = Date.now() - 45_000;
  await db
    .update(notes)
    .set({
      status: "error",
      summary:
        "AI processing timed out. Open the ••• menu and click Re-analyze with AI to try again.",
      updatedAt: Date.now(),
    })
    .where(and(eq(notes.status, "processing"), lt(notes.updatedAt, staleCutoff)));

  const [projectRows, spaceRows, noteRows, settingsRows] = await Promise.all([
    db
      .select()
      .from(projects)
      .orderBy(asc(projects.position), asc(projects.createdAt)),
    db.select().from(spaces).orderBy(asc(spaces.position), asc(spaces.createdAt)),
    db.select().from(notes).orderBy(desc(notes.createdAt)).limit(400),
    db.select().from(appSettings).where(eq(appSettings.id, "owner")),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const spendRows = await db
    .select({
      usedByok: notes.usedByok,
      total: sql<number>`COALESCE(SUM(${notes.costUsd}), 0)`,
    })
    .from(notes)
    .where(gte(notes.createdAt, monthStart))
    .groupBy(notes.usedByok);

  let monthlySystemSpendUsd = 0;
  let monthlyByokSpendUsd = 0;
  for (const row of spendRows) {
    if (row.usedByok) {
      monthlyByokSpendUsd += Number(row.total);
    } else {
      monthlySystemSpendUsd += Number(row.total);
    }
  }

  const cfg = settingsRows[0];
  const rawGemini = decryptSecret(cfg?.encryptedGeminiKey);
  const rawOpenai = decryptSecret(cfg?.encryptedOpenaiKey);
  const hasSystemKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim()
  );

  const settings: ClientSettings = {
    userContext: cfg?.userContext || "",
    activeProvider: cfg?.activeProvider || "gemini",
    preferByok: cfg?.preferByok ?? true,
    hasGeminiByok: Boolean(rawGemini),
    maskedGeminiKey: maskApiKey(rawGemini),
    hasOpenaiByok: Boolean(rawOpenai),
    maskedOpenaiKey: maskApiKey(rawOpenai),
    hasSystemKey,
    monthlySystemBudgetUsd: cfg?.monthlySystemBudgetUsd ?? 2.0,
    passwordProtectionEnabled: isPasswordProtectionEnabled(),
  };

  const freeUsage = await getCurrentMonthFreeUsage();
  const freeCreditsRemaining = Math.max(
    0,
    FREE_MONTHLY_AI_LIMIT - freeUsage.count
  );

  const usageStats: UsageStats = {
    monthlySystemSpendUsd: Number(monthlySystemSpendUsd.toFixed(4)),
    monthlyByokSpendUsd: Number(monthlyByokSpendUsd.toFixed(4)),
    totalNotesCount: noteRows.length,
    freeCreditsUsed: freeUsage.count,
    freeCreditsLimit: FREE_MONTHLY_AI_LIMIT,
    freeCreditsRemaining,
  };

  return NextResponse.json({
    projects: projectRows.map(serializeProject),
    spaces: spaceRows.map(serializeSpace),
    notes: noteRows.map(serializeNote),
    settings,
    usageStats,
  });
}
