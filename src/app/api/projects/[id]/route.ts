import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { notes, projects } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { serializeProject } from "@/lib/serializers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
  };

  const db = await ensureDbReady();
  const existing = await db.select().from(projects).where(eq(projects.id, id));
  const row = existing[0];
  if (!row) {
    return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
  }

  const nextName = body.name?.trim().slice(0, 40) || row.name;
  const nextDesc =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 200)
      : row.description;

  await db
    .update(projects)
    .set({ name: nextName, description: nextDesc })
    .where(eq(projects.id, id));

  const updated = await db.select().from(projects).where(eq(projects.id, id));
  return NextResponse.json({ project: serializeProject(updated[0]!) });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "move";
  const targetProjectId =
    url.searchParams.get("targetProjectId")?.trim() || "default";

  const db = await ensureDbReady();
  const rows = await db.select().from(projects).where(eq(projects.id, id));
  const project = rows[0];

  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
  }
  if (project.isDefault || id === "default") {
    return NextResponse.json(
      { error: "Varsayılan proje silinemez." },
      { status: 400 }
    );
  }

  if (mode === "delete_all") {
    await db.delete(notes).where(eq(notes.projectId, id));
  } else {
    const safeTargetId = targetProjectId === id ? "default" : targetProjectId;
    await db
      .update(notes)
      .set({ projectId: safeTargetId, updatedAt: Date.now() })
      .where(eq(notes.projectId, id));
  }

  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
