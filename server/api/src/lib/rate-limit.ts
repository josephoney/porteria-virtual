interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  current.count += 1;
  if (current.count > limit) return true;
  return false;
}

export function rateLimitKey(prefix: string, request: { ip?: string; url?: string }): string {
  return `${prefix}:${request.ip ?? 'unknown'}:${request.url ?? ''}`;
}
