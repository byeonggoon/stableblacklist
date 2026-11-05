import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getRedis } from '@/lib/upstash';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'sbl_timeline_v2';
const CACHE_TTL = 300; // 5분 (추이는 천천히 변함)
const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';

/**
 * 월별 달러 합계 (UTC 월 기준). 동결액은 동결 시점 잔액을 저장하지 않으므로
 * 소각된 주소는 소각액, 그 외는 현재 잔액으로 근사한다.
 * 1000행 제한 때문에 페이지 단위로 읽는다 (결과는 5분 캐시).
 */
async function monthlyUsd() {
  const sb = getSupabase();
  const map = new Map<string, { frozen: number; destroyed: number }>();
  const bucket = (k: string) => map.get(k) ?? map.set(k, { frozen: 0, destroyed: 0 }).get(k)!;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('sbl_frozen_wallets')
      .select('balance,destroyed_amount,frozen_at,destroyed_at')
      .order('address').order('token').order('chain')
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const r of data) {
      const destroyed = Number(r.destroyed_amount ?? 0);
      if (r.frozen_at) bucket(r.frozen_at.slice(0, 7)).frozen += destroyed || Number(r.balance ?? 0);
      if (r.destroyed_at && destroyed) bucket(r.destroyed_at.slice(0, 7)).destroyed += destroyed;
    }
    if (data.length < PAGE) break;
  }
  return map;
}

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
  const [{ data: monthly }, { data: gap }, usd] = await Promise.all([
    sb.rpc('sbl_monthly_activity'),
    sb.rpc('sbl_freeze_destroy_gap'),
    monthlyUsd(),
  ]);

  // 스테이블코인이라 1토큰 = $1. 건수 행에 달러 합계를 붙인다.
  const rows = (monthly ?? []).map((m: { month: string }) => ({
    ...m,
    frozenUsd: Math.round(usd.get(m.month)?.frozen ?? 0),
    destroyedUsd: Math.round(usd.get(m.month)?.destroyed ?? 0),
  }));

  const payload = { monthly: rows, gap: gap ?? [] };
  if (redis) {
    try { await redis.set(CACHE_KEY, payload, { ex: CACHE_TTL }); } catch { /* 무시 */ }
  }
  return NextResponse.json(payload);
}
