import { NextResponse } from 'next/server';
import { syncEth } from '@/lib/indexer/eth-indexer';
import { syncTron } from '@/lib/indexer/tron-indexer';
import { syncOfac } from '@/lib/sanctions/fetch-ofac';
import { getCursor, setCursor } from '@/lib/db/frozen-repo';

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

    // OFAC 제재 리스트는 변경이 드물어 하루 1회만 갱신
    let ofac: unknown = 'skipped';
    const lastOfac = await getCursor('lastOfacSync');
    if (!lastOfac || Date.now() - Number(lastOfac) > 86_400_000) {
      ofac = await syncOfac();
      await setCursor('lastOfacSync', String(Date.now()));
    }

    return NextResponse.json({ ok: true, eth, tron, ofac, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
