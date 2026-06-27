import { NextResponse } from 'next/server';
import { syncEth } from '@/lib/indexer/eth-indexer';
import { syncTron } from '@/lib/indexer/tron-indexer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cron / 외부 cron 인증
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const eth = await syncEth();
    const tron = await syncTron();
    return NextResponse.json({ ok: true, eth, tron, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
