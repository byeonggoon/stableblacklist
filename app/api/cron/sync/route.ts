import { NextResponse } from 'next/server';
import { syncEth } from '@/lib/indexer/eth-indexer';
import { syncTron } from '@/lib/indexer/tron-indexer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ⚠ 발행사 동결(ETH/Tron) 증분만 처리해 서버리스 함수 한도 안에 끝냄.
//   OFAC 수집(5.5MB CSV 파싱)은 무거워서 별도 GitHub Actions 잡(.github/workflows/ofac.yml)으로 분리.
export async function GET(req: Request) {
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
