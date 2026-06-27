import { describe, it, expect } from 'vitest';
import { decodeLog, type DecodedEvent } from '../events';
import {
  TOPIC_ADDED_BLACKLIST, TOPIC_DESTROYED_BLACKFUNDS, TOPIC_BLACKLISTED,
} from '@/lib/chains/contracts';

const ADDR_WORD = '0x000000000000000000000000abc0000000000000000000000000000000000001';
const ADDR = '0xabc0000000000000000000000000000000000001';

describe('decodeLog', () => {
  it('USDT AddedBlackList(non-indexed): 주소를 DATA 에서 추출', () => {
    const ev = decodeLog({ topics: [TOPIC_ADDED_BLACKLIST], data: ADDR_WORD, timeStamp: '0x60000000' }) as DecodedEvent;
    expect(ev.type).toBe('Add');
    expect(ev.address).toBe(ADDR);
    expect(ev.ts).toBe(0x60000000);
  });

  it('USDT DestroyedBlackFunds: DATA word0=주소, word1=금액', () => {
    const data = ADDR_WORD + '00000000000000000000000000000000000000000000000000000000000f4240'; // +1,000,000
    const ev = decodeLog({ topics: [TOPIC_DESTROYED_BLACKFUNDS], data, timeStamp: '0x60000000' }) as DecodedEvent;
    expect(ev.type).toBe('Destroy');
    expect(ev.address).toBe(ADDR);
    if (ev.type === 'Destroy') expect(ev.amount).toBe(1000000n);
  });

  it('USDC Blacklisted(indexed): 주소를 topics[1] 에서 추출', () => {
    const ev = decodeLog({ topics: [TOPIC_BLACKLISTED, ADDR_WORD], data: '0x', timeStamp: '0x1' }) as DecodedEvent;
    expect(ev.type).toBe('Add');
    expect(ev.address).toBe(ADDR);
  });

  it('알 수 없는 topic0 → null', () => {
    expect(decodeLog({ topics: ['0xdeadbeef'], data: '0x', timeStamp: '0x1' })).toBeNull();
  });
});
