import type { DecodedEvent } from './events';

export type FreezeStatus = 'frozen' | 'destroyed' | 'unfrozen';

export interface FrozenRow {
  address: string;
  token: string;
  chain: string;
  status: FreezeStatus;
  balance: number;          // 사람이 읽는 USDT/USDC 금액 (raw/1e6, chase-chain 방식)
  frozen_at: number | null;
  destroyed_amount?: number; // 소각 금액 (USDT 단위)
  destroyed_at?: number;
}

const DECIMALS = 1e6; // USDT/USDC 모두 6 decimals

/** 현재 행(없으면 null) + 이벤트 → 다음 행 상태 (순수). */
export function applyEvent(
  current: FrozenRow | null,
  ev: DecodedEvent,
  ctx: { token: string; chain: string },
): FrozenRow {
  // 주소는 호출자가 체인별로 정규화한 상태로 들어옴(ETH=lowercase, Tron=Base58). 여기서 변형 금지.
  const addr = ev.address;
  const row: FrozenRow = current
    ? { ...current }
    : { address: addr, token: ctx.token, chain: ctx.chain, status: 'frozen', balance: 0, frozen_at: null };

  switch (ev.type) {
    case 'Add':
      row.status = 'frozen';
      row.frozen_at = ev.ts;
      return row;
    case 'Destroy':
      row.status = 'destroyed';
      row.destroyed_amount = Number(ev.amount) / DECIMALS; // raw → USDT 단위
      row.destroyed_at = ev.ts;
      row.balance = 0;
      return row;
    case 'Remove':
      row.status = 'unfrozen';
      return row;
  }
}
