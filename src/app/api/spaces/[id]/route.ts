import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { notes, spaces } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await ensureDbReady();
  const rows = await db.select().from(spaces).where(eq(spaces.id, id));
  const space = rows[0];

  if (!space) {
    return NextResponse.json({ error: "Space not found." }, { status: 404 });
  }
  if (space.isSystem) {
    return NextResponse.json(
      { error: "Default core spaces cannot be deleted." },
      { status: 400 }
    );
  }

  // Safely relocate notes to "ideas" so zero data is lost
  await db
    .update(notes)
    .set({ spaceId: "ideas", updatedAt: Date.now() })
    .where(eq(notes.spaceId, id));

  await db.delete(spaces).where(eq(spaces.id, id));
  return NextResponse.json({ ok: true });
}
