import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getDerivedKey(): Buffer {
  const rawSecret =
    process.env.ENCRYPTION_SECRET ||
    process.env.APP_PASSWORD ||
    "zero-friction-dev-fallback-secret-change-in-prod";
  return crypto.createHash("sha256").update(rawSecret).digest();
}

export function encryptSecret(plainText: string): string {
  const trimmed = plainText.trim();
  if (!trimmed) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getDerivedKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3) return "";
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getDerivedKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

export function maskApiKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 5)}••••••${key.slice(-4)}`;
}
