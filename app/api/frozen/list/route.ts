import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';

export async function GET(req: Request) {
  const rl = await checkRateLimit(`list:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? 'all';
  const chain = url.searchParams.get('chain') ?? 'all';
  const status = url.searchParams.get('status') ?? 'frozen';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
  const search = url.searchParams.get('search') ?? '';
  const sort = url.searchParams.get('sort') ?? 'balance_desc';
  const ofac = url.searchParams.get('ofac') === '1'; // 교차: OFAC 제재에도 있는 주소만

  const sb = getSupabase();

  let ofacAddrs: string[] | null = null;
  if (ofac) {
    // 발행사 동결과 겹칠 수 있는 체인(Ethereum/Tron)의 OFAC 주소만
    let sq = sb.from('sbl_sanctioned_addresses').select('address').in('chain', ['Ethereum', 'Tron']);
    if (chain !== 'all') sq = sq.eq('chain', chain);
    const { data: sanc } = await sq;
    ofacAddrs = (sanc ?? []).map((s) => s.address);
    if (ofacAddrs.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, totalPages: 0, frozenSum: 0 });
    }
  }

  let q = sb.from('sbl_frozen_wallets').select('*', { count: 'exact' });
  if (ofacAddrs) q = q.in('address', ofacAddrs);
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
