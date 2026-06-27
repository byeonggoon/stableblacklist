import { createHash } from 'node:crypto';
import { applyEvents } from './apply-events';
import { getCursor, setCursor } from '@/lib/db/frozen-repo';
import { fetchTronBalanceWithRetry } from './_balances.mjs';
import type { DecodedEvent } from './events';

const USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRONGRID = 'https://api.trongrid.io';
const RATE_MS = 220;
const MAX_RETRY = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── hex(20-byte) → Base58Check (Tron 주소) — chase-chain 이식 ───
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();

function base58Encode(buffer: Buffer): string {
  const digits = [0];
  for (const byte of buffer) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let result = '';
  for (const byte of buffer) { if (byte === 0) result += B58[0]; else break; }
  for (let i = digits.length - 1; i >= 0; i--) result += B58[digits[i]];
  return result;
}

function hexToBase58Check(hexAddr: string): string {
  const clean = hexAddr.replace(/^0x/, '');
  const payload = Buffer.from('41' + clean, 'hex');
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, checksum]));
}

// ─── TronGrid 디코드 이벤트 페이지네이션 ───
interface TronRaw { hex: string; ts: number; amount?: string }

async function fetchEvents(eventName: string, minTs: number): Promise<TronRaw[]> {
  const out: TronRaw[] = [];
  let fingerprint = '';
  const tsParam = minTs > 0 ? `&min_block_timestamp=${minTs}` : '';
  let retries = 0;

  while (true) {
    const url = `${TRONGRID}/v1/contracts/${USDT}/events?event_name=${eventName}&only_confirmed=true&limit=200${tsParam}${fingerprint ? `&fingerprint=${fingerprint}` : ''}`;
    await sleep(RATE_MS);
    const res = await fetch(url);
    if (!res.ok) {
      if (++retries > MAX_RETRY) break;
      await sleep(2000 * retries);
      continue;
    }
    retries = 0;
    const json = await res.json();
    const events = json.data || [];
    if (events.length === 0) break;
    for (const e of events) {
      const hex: string | undefined = e.result?._user || e.result?.user || e.result?._blackListedUser || e.result?.blackListedUser;
      const amount: string | undefined = e.result?._balance ?? e.result?.balance;
      if (hex) out.push({ hex: hex.replace(/^0x/, '').toLowerCase(), ts: e.block_timestamp || 0, amount });
    }
    fingerprint = json.meta?.fingerprint;
    if (!fingerprint) break;
  }
  return out;
}

// frozen 주소들의 Tron USDT balanceOf (동시 5)
async function tronRefreshBalances(addrs: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const CONC = 5;
  for (let i = 0; i < addrs.length; i += CONC) {
    const batch = addrs.slice(i, i + CONC);
    const bals = await Promise.all(batch.map((a) => fetchTronBalanceWithRetry(a)));
    batch.forEach((a, j) => map.set(a, bals[j]));
    await sleep(RATE_MS);
  }
  return map;
}

export async function syncTron(): Promise<{ token: string; events: number }[]> {
  const cursor = await getCursor('lastTronTimestamp');
  const minTs = cursor ? Number(cursor) : 0;

  const [added, removed, destroyed] = await Promise.all([
    fetchEvents('AddedBlackList', minTs),
    fetchEvents('RemovedBlackList', minTs),
    fetchEvents('DestroyedBlackFunds', minTs), // best-effort: Tron USDT 에 없으면 빈 배열
  ]);

  const events: DecodedEvent[] = [];
  for (const e of added) events.push({ type: 'Add', address: hexToBase58Check(e.hex), ts: Math.floor(e.ts / 1000) });
  for (const e of removed) events.push({ type: 'Remove', address: hexToBase58Check(e.hex), ts: Math.floor(e.ts / 1000) });
  for (const e of destroyed) {
    if (e.amount != null) events.push({ type: 'Destroy', address: hexToBase58Check(e.hex), amount: BigInt(e.amount), ts: Math.floor(e.ts / 1000) });
  }
  events.sort((a, b) => a.ts - b.ts);

  const count = await applyEvents(events, { token: 'USDT', chain: 'Tron', refreshBalances: tronRefreshBalances });
  await setCursor('lastTronTimestamp', String(Date.now()));
  return [{ token: 'USDT', events: count }];
}
