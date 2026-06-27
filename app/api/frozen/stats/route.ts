import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

export async function GET() {
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

  return NextResponse.json({
    frozen,
    destroyed,
    unfrozen,
    totalFrozenSum,
    breakdown,
    lastUpdated: last?.updated_at ?? null,
  });
}
