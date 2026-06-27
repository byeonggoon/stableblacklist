import { applyRawLogs, type RawLog } from './apply-events';
import { getCursor, setCursor } from '@/lib/db/frozen-repo';
import { fetchEthBalances } from './_balances.mjs';
import {
  ETH_USDT, ETH_USDC,
  TOPIC_ADDED_BLACKLIST, TOPIC_REMOVED_BLACKLIST, TOPIC_DESTROYED_BLACKFUNDS,
  TOPIC_BLACKLISTED, TOPIC_UNBLACKLISTED,
} from '@/lib/chains/contracts';

const ETHERSCAN = 'https://api.etherscan.io/v2/api';
const RATE_MS = 220;
const FIRST_RUN_LOOKBACK = 3_000_000; // 첫 실행 시 최근 ~1년만 (속도). 이후는 커서 기반 증분.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function esUrl(params: Record<string, string>): string {
  const u = new URL(ETHERSCAN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('chainid', '1');
  if (process.env.ETHERSCAN_API_KEY) u.searchParams.set('apikey', process.env.ETHERSCAN_API_KEY);
  return u.toString();
}

async function latestBlock(): Promise<number> {
  const j = await fetch(esUrl({ module: 'proxy', action: 'eth_blockNumber' })).then((r) => r.json());
  return parseInt(j.result, 16);
}

// 1000건 초과 시 블록 범위 재귀 분할
async function fetchLogs(contract: string, topic0: string, from: number, to: number): Promise<RawLog[]> {
  await sleep(RATE_MS);
  const res = await fetch(
    esUrl({ module: 'logs', action: 'getLogs', address: contract, topic0, fromBlock: String(from), toBlock: String(to) }),
  ).then((r) => r.json());
  if (res.status === '0' && res.message === 'No records found') return [];
  if (res.status === '0') throw new Error(`Etherscan getLogs: ${res.message} ${res.result ?? ''}`);
  const logs = res.result as RawLog[];
  if (logs.length < 1000) return logs;
  const mid = Math.floor((from + to) / 2);
  return [...(await fetchLogs(contract, topic0, from, mid)), ...(await fetchLogs(contract, topic0, mid + 1, to))];
}

interface TokenCfg { token: string; contract: string; topics: string[] }
const TOKENS: TokenCfg[] = [
  { token: 'USDT', contract: ETH_USDT, topics: [TOPIC_ADDED_BLACKLIST, TOPIC_REMOVED_BLACKLIST, TOPIC_DESTROYED_BLACKFUNDS] },
  { token: 'USDC', contract: ETH_USDC, topics: [TOPIC_BLACKLISTED, TOPIC_UNBLACKLISTED] },
];

export async function syncEth(): Promise<{ token: string; events: number }[]> {
  const latest = await latestBlock();
  const cursor = await getCursor('lastEthBlock');
  const fromBlock = cursor ? Number(cursor) + 1 : Math.max(0, latest - FIRST_RUN_LOOKBACK);

  const results: { token: string; events: number }[] = [];
  for (const { token, contract, topics } of TOKENS) {
    const rawLogs = (await Promise.all(topics.map((t) => fetchLogs(contract, t, fromBlock, latest)))).flat();
    const events = await applyRawLogs({
      rawLogs,
      token,
      chain: 'Ethereum',
      refreshBalances: (addrs) => fetchEthBalances(addrs, contract, process.env.ALCHEMY_ENDPOINT_ETHEREUM),
    });
    results.push({ token, events });
  }

  if (Number.isFinite(latest) && latest > 0) await setCursor('lastEthBlock', String(latest));
  return results;
}
