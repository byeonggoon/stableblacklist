import { describe, it, expect } from 'vitest';
import { rowToDb } from '../frozen-repo';

describe('rowToDb', () => {
  it('number 금액을 string 으로, ts 를 ISO 로 변환', () => {
    const dbRow = rowToDb({
      address: '0xa', token: 'USDT', chain: 'Ethereum', status: 'destroyed',
      balance: 0, frozen_at: 100, destroyed_amount: 5, destroyed_at: 200,
    });
    expect(dbRow.balance).toBe('0');
    expect(dbRow.destroyed_amount).toBe('5');
    expect(dbRow.frozen_at).toBe(new Date(100 * 1000).toISOString());
    expect(dbRow.destroyed_at).toBe(new Date(200 * 1000).toISOString());
    expect(dbRow.status).toBe('destroyed');
  });

  it('null/undefined ts·destroyed 필드 처리', () => {
    const dbRow = rowToDb({
      address: '0xb', token: 'USDC', chain: 'Ethereum', status: 'frozen',
      balance: 12345.67, frozen_at: null,
    });
    expect(dbRow.balance).toBe('12345.67');
    expect(dbRow.frozen_at).toBeNull();
    expect(dbRow.destroyed_amount).toBeNull();
    expect(dbRow.destroyed_at).toBeNull();
  });
});
