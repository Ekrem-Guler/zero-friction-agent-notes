import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "zf_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function isPasswordProtectionEnabled(): boolean {
  const pwd = process.env.APP_PASSWORD?.trim();
  return Boolean(pwd && pwd.length > 0);
}

export function computeSessionToken(password: string): string {
  const secret =
    process.env.ENCRYPTION_SECRET || "zero-friction-session-signing-key";
  return crypto
    .createHmac("sha256", secret)
    .update(`owner:${password.trim()}`)
    .digest("hex");
}

export function verifyPassword(input: string): boolean {
  const configured = process.env.APP_PASSWORD?.trim();
  if (!configured) return true;
  const a = Buffer.from(input.trim());
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isPasswordProtectionEnabled()) {
    return true;
  }
  const expected = computeSessionToken(process.env.APP_PASSWORD!);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
