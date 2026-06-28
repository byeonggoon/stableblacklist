import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';

export async function GET(req: Request) {
  const rl = await checkRateLimit(`sanctions:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const url = new URL(req.url);
  const chain = url.searchParams.get('chain') ?? 'all';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '25')));
  const search = url.searchParams.get('search') ?? '';

  const sb = getSupabase();
  let q = sb.from('sbl_sanctioned_addresses').select('*', { count: 'exact' });
  if (chain !== 'all') q = q.eq('chain', chain);
  if (search) q = q.ilike('address', `${search}%`);
  q = q.order('entity', { ascending: true, nullsFirst: false })
    .order('chain', { ascending: true }).order('address', { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    items: data,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
