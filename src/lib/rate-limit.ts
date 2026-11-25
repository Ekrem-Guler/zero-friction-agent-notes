export const SECURITY_LIMITS = {
  MAX_TEXT_CHARS: 500,
  MAX_AUDIO_BYTES: 2.5 * 1024 * 1024, // 2.5 MB (~45s audio)
  MAX_AUDIO_SECONDS: 45,
  MAX_OUTPUT_TOKENS: 1024,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX_REQUESTS: 6, // Max 6 AI notes per minute
} as const;

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const windowStart = now - SECURITY_LIMITS.RATE_LIMIT_WINDOW_MS;
  const bucket = buckets.get(identifier) ?? { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  if (bucket.timestamps.length >= SECURITY_LIMITS.RATE_LIMIT_MAX_REQUESTS) {
    const oldest = bucket.timestamps[0]!;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + SECURITY_LIMITS.RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    buckets.set(identifier, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(identifier, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}
