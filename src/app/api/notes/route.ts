import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { ensureDbReady } from "@/db";
import { notes } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { processAndEnrichNote } from "@/lib/ai-agent";
import { checkRateLimit, SECURITY_LIMITS } from "@/lib/rate-limit";
import { serializeNote } from "@/lib/serializers";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "owner";
  const rl = checkRateLimit(`notes:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Hız sınırı aşıldı (dakikada en fazla ${SECURITY_LIMITS.RATE_LIMIT_MAX_REQUESTS} not). Lütfen ${rl.retryAfterSeconds} sn bekleyin.`,
      },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    text?: string;
    projectId?: string;
    parentId?: string | null;
    preferredSpaceId?: string;
    useAi?: boolean;
  };

  const trimmed = (body.text || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Boş not gönderilemez." }, { status: 400 });
  }
  if (trimmed.length > SECURITY_LIMITS.MAX_TEXT_CHARS) {
    return NextResponse.json(
      {
        error: `Hızlı not sınırı en fazla ${SECURITY_LIMITS.MAX_TEXT_CHARS} karakterdir.`,
      },
      { status: 400 }
    );
  }

  const db = await ensureDbReady();
  const now = Date.now();
  const id = crypto.randomUUID();
  const projectId = body.projectId?.trim() || "default";
  const parentId = body.parentId?.trim() || null;
  const useAi = body.useAi !== false;

  const initialRow: typeof notes.$inferInsert = {
    id,
    userId: "owner",
    projectId,
    parentId,
    spaceId: body.preferredSpaceId || "ideas",
    rawText: trimmed,
    inputType: "text",
    status: useAi ? "processing" : "completed",
    title:
      useAi && trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed,
    summary: useAi ? "Yapay zeka ajanı analiz ediyor..." : "",
    metadataJson: "{}",
    suggestedSpace: null,
    providerUsed: useAi ? "pending" : "raw-only",
    usedByok: false,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(notes).values(initialRow);

  if (useAi) {
    after(async () => {
      await processAndEnrichNote(id, trimmed);
    });
  }

  const saved = {
    ...initialRow,
    suggestedSpace: null,
  };

  return NextResponse.json(
    { note: serializeNote(saved as typeof notes.$inferSelect) },
    { status: 201 }
  );
}
