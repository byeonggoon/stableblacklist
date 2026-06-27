import {
  TOPIC_ADDED_BLACKLIST, TOPIC_REMOVED_BLACKLIST, TOPIC_DESTROYED_BLACKFUNDS,
  TOPIC_BLACKLISTED, TOPIC_UNBLACKLISTED,
} from '@/lib/chains/contracts';

export type DecodedEvent =
  | { type: 'Add'; address: string; ts: number }
  | { type: 'Remove'; address: string; ts: number }
  | { type: 'Destroy'; address: string; amount: bigint; ts: number };

interface RawLog { topics: string[]; data: string; timeStamp: string }

// indexed 파라미터: topics 에서 (오른쪽 40 hex)
function addrFromTopic(topic: string): string {
  return ('0x' + topic.slice(-40)).toLowerCase();
}
// non-indexed 파라미터: data 의 wordIndex 번째 32바이트 워드에서
function addrFromDataWord(data: string, wordIndex = 0): string {
  return ('0x' + data.slice(2 + wordIndex * 64).slice(24, 64)).toLowerCase();
}
function uintFromDataWord(data: string, wordIndex: number): bigint {
  return BigInt('0x' + data.slice(2 + wordIndex * 64, 2 + (wordIndex + 1) * 64));
}

export function decodeLog(log: RawLog): DecodedEvent | null {
  const t0 = log.topics[0]?.toLowerCase();
  const ts = parseInt(log.timeStamp, 16);
  switch (t0) {
    // USDT(Tether): non-indexed → 주소가 DATA 에 있음 (실측 확정)
    case TOPIC_ADDED_BLACKLIST.toLowerCase():
      return { type: 'Add', address: addrFromDataWord(log.data), ts };
    case TOPIC_REMOVED_BLACKLIST.toLowerCase():
      return { type: 'Remove', address: addrFromDataWord(log.data), ts };
    case TOPIC_DESTROYED_BLACKFUNDS.toLowerCase():
      return { type: 'Destroy', address: addrFromDataWord(log.data, 0), amount: uintFromDataWord(log.data, 1), ts };
    // USDC(Circle): indexed → 주소가 topics[1] 에 있음
    case TOPIC_BLACKLISTED.toLowerCase():
      return { type: 'Add', address: addrFromTopic(log.topics[1]), ts };
    case TOPIC_UNBLACKLISTED.toLowerCase():
      return { type: 'Remove', address: addrFromTopic(log.topics[1]), ts };
    default:
      return null;
  }
}
