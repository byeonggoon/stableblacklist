// Upstash Redis 기반 레이트 리미터 (서버리스 환경용).
// UPSTASH 미설정 시 인메모리 LRU 로 graceful fallback (개발/로컬). chase-chain 패턴 이식.

import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './upstash';

interface RateLimitEntry { count: number; resetAt: number }

/** 만료/LRU 자동 축출되는 바운디드 인메모리 스토어 (서버리스 폴백용). */
class LRURateLimitStore {
  private map = new Map<string, RateLimitEntry>();
  private readonly maxSize: number;
  constructor(maxSize = 10_000) { this.maxSize = maxSize; }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.resetAt) { this.map.delete(key); return undefined; }
    this.map.delete(key); this.map.set(key, entry);
    return entry;
  }
  set(key: string, entry: RateLimitEntry): void {
    this.map.delete(key);
    if (this.map.size >= this.maxSize) this.evict();
    this.map.set(key, entry);
  }
  private evict(): void {
    const now = Date.now();
    const target = Math.max(1, Math.floor(this.maxSize * 0.1));
    let evicted = 0;
    for (const [k, v] of this.map) {
      if (now > v.resetAt) { this.map.delete(k); evicted++; }
      if (evicted >= target) return;
    }
    for (const k of this.map.keys()) {
      if (this.map.size < this.maxSize) break;
      this.map.delete(k);
    }
  }
}

const store = new LRURateLimitStore();

function checkLocal(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

const rlCache = new Map<string, Ratelimit>();

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();
  if (redis) {
    const cacheKey = `${limit}:${windowMs}`;
    let ratelimit = rlCache.get(cacheKey);
    if (!ratelimit) {
      ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`), prefix: 'sbl_rl' });
      rlCache.set(cacheKey, ratelimit);
    }
    try {
      const { success, remaining, reset } = await ratelimit.limit(key);
      return { allowed: success, remaining, resetAt: reset };
    } catch (err) {
      // Upstash 장애 시 레이트리밋 인프라 때문에 500 내지 않고 인메모리로 강등.
      console.warn('[rate-limit] Redis failed, fallback to in-memory:', err instanceof Error ? err.message : err);
      return checkLocal(key, limit, windowMs);
    }
  }
  return checkLocal(key, limit, windowMs);
}
