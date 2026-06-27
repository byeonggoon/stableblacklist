import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? 'all';
  const chain = url.searchParams.get('chain') ?? 'all';
  const status = url.searchParams.get('status') ?? 'frozen';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
  const search = url.searchParams.get('search') ?? '';
  const sort = url.searchParams.get('sort') ?? 'balance_desc';

  const sb = getSupabase();
  let q = sb.from('sbl_frozen_wallets').select('*', { count: 'exact' });
  if (token !== 'all') q = q.eq('token', token);
  if (chain !== 'all') q = q.eq('chain', chain);
  if (status !== 'all') q = q.eq('status', status);
  if (search) q = q.ilike('address', `${search}%`);

  const [col, dir] = sort.split('_');
  const sortCol = col === 'date' ? 'frozen_at' : 'balance';
  q = q.order(sortCol, { ascending: dir === 'asc' }).range((page - 1) * limit, page * limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: frozenSum } = await sb.rpc('sbl_frozen_balance_sum', { p_token: token, p_chain: chain });
  return NextResponse.json({
    items: data,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
    frozenSum: frozenSum ?? 0,
  });
}
