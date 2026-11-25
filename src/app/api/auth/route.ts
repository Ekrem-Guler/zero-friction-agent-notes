import { NextResponse } from "next/server";
import {
  computeSessionToken,
  getSessionCookieOptions,
  isPasswordProtectionEnabled,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(`auth:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Çok fazla deneme. ${rl.retryAfterSeconds} sn bekleyin.` },
      { status: 429 }
    );
  }

  if (!isPasswordProtectionEnabled()) {
    return NextResponse.json({ ok: true });
  }

  const body = (await request.json().catch(() => ({}))) as {
    password?: string;
  };
  const password = body.password || "";

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Hatalı giriş şifresi." }, { status: 401 });
  }

  const token = computeSessionToken(process.env.APP_PASSWORD!);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
