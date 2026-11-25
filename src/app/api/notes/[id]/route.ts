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
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await ensureDbReady();
  const existing = await db.select().from(notes).where(eq(notes.id, id));
  const row = existing[0];
  if (!row) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    spaceId?: string;
    toggleCompleted?: boolean;
    toggleShowRaw?: boolean;
    togglePromotedToSpace?: boolean;
    toggleSubtaskId?: string;
    dismissSuggestion?: boolean;
    action?: "reprocess";
  };

  if (body.action === "reprocess") {
    const rl = checkRateLimit("reprocess:owner");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Please wait ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    await db
      .update(notes)
      .set({
        status: "processing",
        summary: "Re-analyzing...",
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

  if (body.toggleShowRaw) {
    meta.showRawOnly = !meta.showRawOnly;
  }

  if (body.togglePromotedToSpace) {
    meta.promotedToSpace = !meta.promotedToSpace;
  }

  if (body.toggleSubtaskId && Array.isArray(meta.subtasks)) {
    meta.subtasks = meta.subtasks.map((st) =>
      st.id === body.toggleSubtaskId ? { ...st, done: !st.done } : st
    );
  }

  await db
    .update(notes)
    .set({
      projectId: body.projectId ?? row.projectId,
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
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await ensureDbReady();
  // Detach any direct child notes so nested comments are never silently lost
  await db
    .update(notes)
    .set({ parentId: null, updatedAt: Date.now() })
    .where(eq(notes.parentId, id));
  await db.delete(notes).where(eq(notes.id, id));
  return NextResponse.json({ ok: true });
}
