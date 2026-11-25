import { after, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { notes, type NoteMetadata } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { processAndEnrichNote } from "@/lib/ai-agent";
import { checkRateLimit } from "@/lib/rate-limit";
import { serializeNote } from "@/lib/serializers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await ensureDbReady();
  const existing = await db.select().from(notes).where(eq(notes.id, id));
  const row = existing[0];
  if (!row) {
    return NextResponse.json({ error: "Not bulunamadı." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    spaceId?: string;
    toggleCompleted?: boolean;
    toggleSubtaskId?: string;
    dismissSuggestion?: boolean;
    action?: "reprocess";
  };

  if (body.action === "reprocess") {
    const rl = checkRateLimit("reprocess:owner");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Lütfen ${rl.retryAfterSeconds} sn bekleyin.` },
        { status: 429 }
      );
    }

    await db
      .update(notes)
      .set({
        status: "processing",
        summary: "Yeniden analiz ediliyor...",
        updatedAt: Date.now(),
      })
      .where(eq(notes.id, id));

    after(async () => {
      await processAndEnrichNote(id, row.rawText, row.costUsd);
    });

    const refreshed = await db.select().from(notes).where(eq(notes.id, id));
    return NextResponse.json({ note: serializeNote(refreshed[0]!) });
  }

  let meta: NoteMetadata = {};
  try {
    meta = JSON.parse(row.metadataJson || "{}") as NoteMetadata;
  } catch {
    meta = {};
  }

  if (body.toggleCompleted) {
    meta.isCompleted = !meta.isCompleted;
  }

  if (body.toggleSubtaskId && Array.isArray(meta.subtasks)) {
    meta.subtasks = meta.subtasks.map((st) =>
      st.id === body.toggleSubtaskId ? { ...st, done: !st.done } : st
    );
  }

  await db
    .update(notes)
    .set({
      spaceId: body.spaceId ?? row.spaceId,
      suggestedSpace: body.dismissSuggestion
        ? null
        : body.spaceId
          ? null
          : row.suggestedSpace,
      metadataJson: JSON.stringify(meta),
      updatedAt: Date.now(),
    })
    .where(eq(notes.id, id));

  const updated = await db.select().from(notes).where(eq(notes.id, id));
  return NextResponse.json({ note: serializeNote(updated[0]!) });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await ensureDbReady();
  await db.delete(notes).where(eq(notes.id, id));
  return NextResponse.json({ ok: true });
}
