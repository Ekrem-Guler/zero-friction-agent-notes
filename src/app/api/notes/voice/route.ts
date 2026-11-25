import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { ensureDbReady } from "@/db";
import { notes } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { processAndEnrichNote, transcribeVoiceNote } from "@/lib/ai-agent";
import { checkRateLimit, SECURITY_LIMITS } from "@/lib/rate-limit";
import { serializeNote } from "@/lib/serializers";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "owner";
  const rl = checkRateLimit(`notes:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit reached. Please wait ${rl.retryAfterSeconds}s.`,
      },
      { status: 429 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const audioFile = formData?.get("audio");
  const projectId =
    (typeof formData?.get("projectId") === "string"
      ? (formData.get("projectId") as string).trim()
      : "") || "default";
  const parentId =
    (typeof formData?.get("parentId") === "string"
      ? (formData.get("parentId") as string).trim()
      : "") || null;

  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json(
      { error: "Audio file not found." },
      { status: 400 }
    );
  }

  if (audioFile.size === 0) {
    return NextResponse.json({ error: "Audio recording is empty." }, { status: 400 });
  }

  if (audioFile.size > SECURITY_LIMITS.MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: `Audio file is too large (max ${SECURITY_LIMITS.MAX_AUDIO_SECONDS} seconds).`,
      },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const mimeType = audioFile.type || "audio/webm";

    const tr = await transcribeVoiceNote(bytes, mimeType);
    if (!tr.transcript) {
      return NextResponse.json(
        { error: "No clear speech detected in the recording." },
        { status: 422 }
      );
    }

    const db = await ensureDbReady();
    const now = Date.now();
    const id = crypto.randomUUID();

    const initialRow: typeof notes.$inferInsert = {
      id,
      userId: "owner",
      projectId,
      parentId,
      spaceId: "ideas",
      rawText: tr.transcript,
      inputType: "voice",
      status: "processing",
      title:
        tr.transcript.length > 60
          ? `${tr.transcript.slice(0, 57)}...`
          : tr.transcript,
      summary: "Voice note transcribed, AI agent is structuring...",
      metadataJson: "{}",
      suggestedSpace: null,
      providerUsed: tr.providerUsed,
      usedByok: tr.usedByok,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: tr.costUsd,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(notes).values(initialRow);

    after(async () => {
      await processAndEnrichNote(id, tr.transcript, tr.costUsd);
    });

    return NextResponse.json(
      { note: serializeNote(initialRow as typeof notes.$inferSelect) },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process voice note.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
