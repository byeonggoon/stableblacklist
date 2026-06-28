import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getRedis } from '@/lib/upstash';
import { checkRateLimit } from '@/lib/rate-limit';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'sbl_stats_v2';
const CACHE_TTL = 60; // seconds — stats 는 15분마다 갱신되므로 60s 캐시로 충분
const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';

async function countRows(sb: SupabaseClient, filters: Record<string, string>): Promise<number> {
  let q = sb.from('sbl_frozen_wallets').select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}

async function frozenSum(sb: SupabaseClient, token: string, chain: string): Promise<number> {
  const { data } = await sb.rpc('sbl_frozen_balance_sum', { p_token: token, p_chain: chain });
  return Number(data ?? 0);
}

async function countSanctioned(sb: SupabaseClient, chain?: string): Promise<number> {
  let q = sb.from('sbl_sanctioned_addresses').select('*', { count: 'exact', head: true });
  if (chain) q = q.eq('chain', chain);
  const { count } = await q; // 테이블 미존재 시 count=null → 0 (graceful)
  return count ?? 0;
}

export async function GET(req: Request) {
  const rl = await checkRateLimit(`stats:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return NextResponse.json(cached);
    } catch { /* 캐시 미스로 진행 */ }
  }

  const sb = getSupabase();

  const [frozen, destroyed, unfrozen, totalFrozenSum] = await Promise.all([
    countRows(sb, { status: 'frozen' }),
    countRows(sb, { status: 'destroyed' }),
    countRows(sb, { status: 'unfrozen' }),
    frozenSum(sb, 'all', 'all'),
  ]);

  const pairs = [
    { token: 'USDT', chain: 'Ethereum' },
    { token: 'USDC', chain: 'Ethereum' },
    { token: 'USDT', chain: 'Tron' },
  ];
  const breakdown = await Promise.all(
    pairs.map(async (p) => ({
      ...p,
      frozenCount: await countRows(sb, { status: 'frozen', token: p.token, chain: p.chain }),
      frozenSum: await frozenSum(sb, p.token, p.chain),
    })),
  );

  const { data: last } = await sb
    .from('sbl_frozen_wallets')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // OFAC 제재 주소 (체인-네이티브 리스트 기준)
  const sanctionedChains = ['Ethereum', 'Bitcoin', 'Tron'];
  const sanctionedBreakdown = await Promise.all(
    sanctionedChains.map(async (c) => ({ chain: c, count: await countSanctioned(sb, c) })),
  );
  const sanctioned = sanctionedBreakdown.reduce((s, x) => s + x.count, 0);

  const payload = {
    frozen,
    destroyed,
    unfrozen,
    totalFrozenSum,
    breakdown,
    sanctioned,
    sanctionedBreakdown,
    lastUpdated: last?.updated_at ?? null,
  };

  if (redis) {
    try { await redis.set(CACHE_KEY, payload, { ex: CACHE_TTL }); } catch { /* 캐시 쓰기 실패 무시 */ }
  }

  return NextResponse.json(payload);
}
