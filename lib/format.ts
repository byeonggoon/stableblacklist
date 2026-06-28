export const fmtUsd0 = (n: number | null | undefined) =>
  '$' + (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const fmtAmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const fmtCount = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('en-US');

export const shortAddr = (a: string) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '');

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toISOString().slice(0, 10) : '—';

export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—';

export function explorerUrl(chain: string, address: string): string {
  if (chain === 'Tron') return `https://tronscan.org/#/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}
