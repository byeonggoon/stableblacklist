'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { HACK_EVENTS } from '@/lib/events';

interface MonthRow { month: string; frozen: number; destroyed: number; frozenUsd: number; destroyedUsd: number }
type Mode = 'count' | 'usd';

// $1.2B / $340M / $12K 처럼 축·툴팁용 축약
const fmtUsdShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

function MonthlyChart({ data, mode }: { data: MonthRow[]; mode: Mode }) {
  const { t } = useT();
  const [hover, setHover] = useState<number | null>(null);

  const W = 880, H = 170, padL = mode === 'usd' ? 40 : 28, padR = 6, padT = 30, padB = 22;
  const fOf = (d: MonthRow) => Number(mode === 'usd' ? d.frozenUsd : d.frozen);
  const dOf = (d: MonthRow) => Number(mode === 'usd' ? d.destroyedUsd : d.destroyed);
  const fmt = (v: number) => (mode === 'usd' ? fmtUsdShort(v) : v.toLocaleString());
  const max = Math.max(1, ...data.map((d) => Math.max(fOf(d), dOf(d))));
  const n = data.length || 1;
  const groupW = (W - padL - padR) / n;
  const barW = Math.max(1.5, Math.min(10, groupW / 2 - 1));
  const labelStep = Math.max(1, Math.ceil(n / 14));
  const plotH = H - padT - padB;
  const yOf = (v: number) => padT + plotH * (1 - v / max);
  const hOf = (v: number) => plotH * (v / max);

  // 사건이 있는 달의 열 인덱스. 라벨이 겹치지 않게 위/아래 두 줄로 번갈아 놓는다
  const events = HACK_EVENTS
    .map((e) => ({ ...e, i: data.findIndex((d) => d.month === e.date.slice(0, 7)) }))
    .filter((e) => e.i >= 0);
  const eventsAt = (i: number) => events.filter((e) => e.i === i);

  const tipLeft = hover === null ? 0 : Math.min(94, Math.max(6, ((padL + hover * groupW + groupW / 2) / W) * 100));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="monthly activity">
        <text x={2} y={padT + 7} className="fill-neutral-600 text-[9px]">{fmt(max)}</text>
        {events.map((e, k) => {
          const cx = padL + e.i * groupW + barW + 0.5;
          const ly = k % 2 === 0 ? 9 : 19;
          return (
            <g key={e.date}>
              <line x1={cx} y1={ly + 3} x2={cx} y2={padT + plotH} className="stroke-sky-400/40" strokeWidth={1} strokeDasharray="2 2" />
              <text x={Math.min(cx, W - padR - 2)} y={ly} textAnchor={cx > W - 40 ? 'end' : 'middle'} className="fill-sky-300/80 text-[8px]">{e.name}</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} className="stroke-white/10" strokeWidth={1} />
        {data.map((d, i) => {
          const x = padL + i * groupW;
          const f = fOf(d), de = dOf(d);
          return (
            <g key={d.month}>
              {hover === i && <rect x={x - 1} y={padT} width={barW * 2 + 3} height={plotH} className="fill-white/5" />}
              <rect x={x} y={yOf(f)} width={barW} height={hOf(f)} className="fill-amber-400/70" rx={1} />
              <rect x={x + barW + 1} y={yOf(de)} width={barW} height={hOf(de)} className="fill-red-400/70" rx={1} />
              {i % labelStep === 0 && <text x={x} y={H - 7} className="fill-neutral-600 text-[8px]">{d.month.slice(2)}</text>}
            </g>
          );
        })}
        {/* 투명 호버 영역 (열 전체) */}
        {data.map((d, i) => (
          <rect key={`h-${d.month}`} x={padL + i * groupW} y={padT} width={groupW} height={plotH}
            fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>

      {hover !== null && (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-white/15 bg-neutral-900/95 px-2 py-1 text-[11px] shadow-lg"
          style={{ left: `${tipLeft}%` }}>
          <div className="font-mono text-neutral-200">{data[hover].month}</div>
          <div className="text-amber-300">{t('legendFrozen')}: {fmt(fOf(data[hover]))}</div>
          <div className="text-red-300">{t('legendDestroyed')}: {fmt(dOf(data[hover]))}</div>
          {eventsAt(hover).map((e) => (
            <div key={e.date} className="mt-0.5 whitespace-nowrap text-sky-300">{e.date} {e.name} {t('eventHack')} ({e.stolen})</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Charts() {
  const { t } = useT();
  const [data, setData] = useState<MonthRow[] | null>(null);
  const [mode, setMode] = useState<Mode>('count');

  useEffect(() => {
    fetch('/api/frozen/timeline').then((r) => r.json()).then((d) => setData(d.monthly ?? [])).catch(() => {});
  }, []);

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex gap-1 text-[11px]">
        {(['count', 'usd'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-md px-2.5 py-1 transition-colors ${mode === m ? 'bg-white/10 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>
            {t(m === 'usd' ? 'chartMonthlyUsd' : 'chartMonthly')}
          </button>
        ))}
      </div>
      {data ? <MonthlyChart data={data} mode={mode} /> : <div className="h-[170px] animate-pulse rounded bg-white/5" />}
      <div className="mt-2 flex gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-400/70" />{t('legendFrozen')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-400/70" />{t('legendDestroyed')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-0 border-l border-dashed border-sky-400/70" />{t('legendHack')}</span>
        {mode === 'usd' && <span className="ml-auto text-neutral-600">{t('chartUsdNote')}</span>}
      </div>
    </section>
  );
}
