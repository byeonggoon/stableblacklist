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

type RefreshBalances = (frozenAddrs: string[]) => Promise<Map<string, number>>;

/**
 * 이미 시간순 정렬된 DecodedEvent[] 를 상태 전이 → (frozen 주소만 balanceOf 갱신) → upsert.
 * ⚠ 주소는 호출자가 체인별로 정규화한 상태여야 함: ETH=lowercase hex, Tron=Base58(대소문자 보존).
 *   그래서 여기서는 toLowerCase 하지 않는다.
 */
export async function applyEvents(
  events: DecodedEvent[],
  opts: { token: string; chain: string; refreshBalances?: RefreshBalances },
): Promise<number> {
  if (events.length === 0) return 0;

  const addrs = [...new Set(events.map((e) => e.address))];
  const rows = await loadRows(addrs, opts.token, opts.chain);
  for (const ev of events) {
    rows.set(ev.address, applyEvent(rows.get(ev.address) ?? null, ev, opts));
  }

  if (opts.refreshBalances) {
    const frozenAddrs = [...rows.values()].filter((r) => r.status === 'frozen').map((r) => r.address);
    if (frozenAddrs.length > 0) {
      const balances = await opts.refreshBalances(frozenAddrs);
      for (const r of rows.values()) {
        if (r.status === 'frozen') r.balance = balances.get(r.address) ?? r.balance;
      }
    }
  }

  await upsertRows([...rows.values()]);
  return events.length;
}

/**
 * EVM raw 로그 전용: (block, logIndex) 순 정렬 → 디코드 → applyEvents.
 * ⚠ ts 정렬 금지: 동결+소각이 같은 블록에 발생하므로 logIndex 까지 정렬해야 전이 순서가 보장됨.
 */
export async function applyRawLogs(opts: {
  rawLogs: RawLog[];
  token: string;
  chain: string;
  refreshBalances?: RefreshBalances;
}): Promise<number> {
  const sorted = [...opts.rawLogs].sort(
    (a, b) =>
      parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16) ||
      parseInt(a.logIndex, 16) - parseInt(b.logIndex, 16),
  );
  const events = sorted.map(decodeLog).filter((e): e is DecodedEvent => e !== null);
  return applyEvents(events, { token: opts.token, chain: opts.chain, refreshBalances: opts.refreshBalances });
}
