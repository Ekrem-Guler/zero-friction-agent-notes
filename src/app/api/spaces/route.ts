import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { notes, spaces, type SpaceKind } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { serializeSpace } from "@/lib/serializers";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    kind?: SpaceKind;
    moveNoteId?: string;
  };

  const name = (body.name || "").trim().slice(0, 36);
  if (!name) {
    return NextResponse.json(
      { error: "Başlık adı boş olamaz." },
      { status: 400 }
    );
  }

  const db = await ensureDbReady();
  const existing = await db
    .select()
    .from(spaces)
    .orderBy(asc(spaces.position));

  const duplicate = existing.find(
    (s) => s.name.trim().toLowerCase() === name.toLowerCase()
  );

  let targetSpace = duplicate;

  if (!targetSpace) {
    const newSpace: typeof spaces.$inferInsert = {
      id: `sp_${crypto.randomUUID().slice(0, 8)}`,
      userId: "owner",
      name,
      kind: body.kind || "custom",
      description: (body.description || "").trim().slice(0, 140),
      icon: "folder",
      position: existing.length,
      isSystem: false,
      createdAt: Date.now(),
    };
    await db.insert(spaces).values(newSpace);
    targetSpace = newSpace as typeof spaces.$inferSelect;
  }

  if (body.moveNoteId && targetSpace) {
    await db
      .update(notes)
      .set({
        spaceId: targetSpace.id,
        suggestedSpace: null,
        updatedAt: Date.now(),
      })
      .where(eq(notes.id, body.moveNoteId));
  }

  return NextResponse.json(
    { space: serializeSpace(targetSpace) },
    { status: 201 }
  );
}
