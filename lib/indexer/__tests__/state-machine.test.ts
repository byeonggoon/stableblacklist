import { describe, it, expect } from 'vitest';
import { applyEvent, type FrozenRow } from '../state-machine';

const base = { token: 'USDT', chain: 'Ethereum' } as const;

describe('applyEvent', () => {
  it('Add: 신규 → frozen', () => {
    const row = applyEvent(null, { type: 'Add', address: '0xa', ts: 100 }, base);
    expect(row).toMatchObject({ address: '0xa', status: 'frozen', frozen_at: 100 });
  });

  it('Destroy: frozen → destroyed, raw 금액을 USDT 단위로 기록, balance 0', () => {
    const frozen: FrozenRow = { address: '0xa', ...base, status: 'frozen', balance: 5, frozen_at: 100 };
    // raw 5,000,000 (6 decimals) → 5 USDT
    const row = applyEvent(frozen, { type: 'Destroy', address: '0xa', amount: 5_000_000n, ts: 200 }, base);
    expect(row).toMatchObject({ status: 'destroyed', destroyed_amount: 5, destroyed_at: 200, balance: 0 });
    expect(row.frozen_at).toBe(100); // 보존
  });

  it('Remove: frozen → unfrozen (행 보존, 합계서 제외)', () => {
    const frozen: FrozenRow = { address: '0xa', ...base, status: 'frozen', balance: 5, frozen_at: 100 };
    const row = applyEvent(frozen, { type: 'Remove', address: '0xa', ts: 300 }, base);
    expect(row.status).toBe('unfrozen');
  });

  it('Destroy 후 Add 재발생: frozen 으로 복귀하되 frozen_at 갱신', () => {
    const destroyed: FrozenRow = { address: '0xa', ...base, status: 'destroyed', balance: 0, frozen_at: 100, destroyed_at: 200, destroyed_amount: 5 };
    const row = applyEvent(destroyed, { type: 'Add', address: '0xa', ts: 400 }, base);
    expect(row.status).toBe('frozen');
    expect(row.frozen_at).toBe(400);
  });
});
