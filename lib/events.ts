// 차트에 표시할 대형 해킹 사건 (탈취액은 사건 당시 달러 기준, 언론 보도치)
export interface ChartEvent { date: string; name: string; stolen: string }

export const HACK_EVENTS: ChartEvent[] = [
  { date: '2020-09-25', name: 'KuCoin', stolen: '$281M' },
  { date: '2021-08-10', name: 'Poly Network', stolen: '$611M' },
  { date: '2022-03-23', name: 'Ronin Bridge', stolen: '$625M' },
  { date: '2022-10-06', name: 'BNB Bridge', stolen: '$570M' },
  { date: '2022-11-11', name: 'FTX', stolen: '$477M' },
  { date: '2023-07-06', name: 'Multichain', stolen: '$126M' },
  { date: '2025-02-21', name: 'Bybit', stolen: '$1.5B' },
  { date: '2025-05-22', name: 'Cetus (Sui)', stolen: '$223M' },
  { date: '2026-09-24', name: 'Bitget', stolen: '$388M' },
  { date: '2026-10-29', name: 'Binance', stolen: '$6.3B' },
];
