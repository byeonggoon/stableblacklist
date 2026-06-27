import { decodeLog, type DecodedEvent } from './events';
import { applyEvent } from './state-machine';
import { loadRows, upsertRows } from '@/lib/db/frozen-repo';

export interface RawLog {
  topics: string[];
  data: string;
  timeStamp: string;
  blockNumber: string;
  logIndex: string;
}

/**
 * raw 로그들을 (블록, logIndex) 순 정렬 → 디코드 → 상태 전이 →
 * (frozen 주소만 balanceOf 갱신) → upsert. ETH/Tron 공통 파이프라인.
 * ⚠ ts 정렬 금지: 동결+소각이 같은 블록에 발생하므로 logIndex 까지 정렬해야 전이 순서가 보장됨.
 */
export async function applyRawLogs(opts: {
  rawLogs: RawLog[];
  token: string;
  chain: string;
  refreshBalances?: (frozenAddrs: string[]) => Promise<Map<string, number>>;
}): Promise<number> {
  const { rawLogs, token, chain, refreshBalances } = opts;

  const sorted = [...rawLogs].sort(
    (a, b) =>
      parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16) ||
      parseInt(a.logIndex, 16) - parseInt(b.logIndex, 16),
  );
  const events = sorted.map(decodeLog).filter((e): e is DecodedEvent => e !== null);
  if (events.length === 0) return 0;

  const addrs = [...new Set(events.map((e) => e.address.toLowerCase()))];
  const rows = await loadRows(addrs, token, chain);
  for (const ev of events) {
    const key = ev.address.toLowerCase();
    rows.set(key, applyEvent(rows.get(key) ?? null, ev, { token, chain }));
  }

  if (refreshBalances) {
    const frozenAddrs = [...rows.values()].filter((r) => r.status === 'frozen').map((r) => r.address);
    if (frozenAddrs.length > 0) {
      const balances = await refreshBalances(frozenAddrs);
      for (const r of rows.values()) {
        if (r.status === 'frozen') r.balance = balances.get(r.address) ?? r.balance;
      }
    }
  }

  await upsertRows([...rows.values()]);
  return events.length;
}
