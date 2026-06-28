import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getRedis } from '@/lib/upstash';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'sbl_timeline_v1';
const CACHE_TTL = 300; // 5분 (추이는 천천히 변함)
const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';

export async function GET(req: Request) {
  const rl = await checkRateLimit(`timeline:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return NextResponse.json(cached);
    } catch { /* 캐시 미스 */ }
  }

  const sb = getSupabase();
  const [{ data: monthly }, { data: gap }] = await Promise.all([
    sb.rpc('sbl_monthly_activity'),
    sb.rpc('sbl_freeze_destroy_gap'),
  ]);

  const payload = { monthly: monthly ?? [], gap: gap ?? [] };
  if (redis) {
    try { await redis.set(CACHE_KEY, payload, { ex: CACHE_TTL }); } catch { /* 무시 */ }
  }
  return NextResponse.json(payload);
}
