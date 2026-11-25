import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { projects } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { serializeProject } from "@/lib/serializers";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    color?: string;
  };

  const name = (body.name || "").trim().slice(0, 40);
  if (!name) {
    return NextResponse.json(
      { error: "Proje adı boş olamaz." },
      { status: 400 }
    );
  }

  const db = await ensureDbReady();
  const existing = await db
    .select()
    .from(projects)
    .orderBy(asc(projects.position));

  const duplicate = existing.find(
    (p) => p.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json({ project: serializeProject(duplicate) });
  }

  const allowedColors = ["emerald", "blue", "violet", "amber", "rose"];
  const color = allowedColors.includes(body.color || "")
    ? body.color!
    : allowedColors[existing.length % allowedColors.length]!;

  const newProject: typeof projects.$inferInsert = {
    id: `prj_${crypto.randomUUID().slice(0, 8)}`,
    userId: "owner",
    name,
    description: (body.description || "").trim().slice(0, 200),
    color,
    position: existing.length,
    isDefault: false,
    createdAt: Date.now(),
  };

  await db.insert(projects).values(newProject);
  return NextResponse.json(
    { project: serializeProject(newProject as typeof projects.$inferSelect) },
    { status: 201 }
  );
}
