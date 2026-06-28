'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

interface MonthRow { month: string; frozen: number; destroyed: number }

function MonthlyChart({ data }: { data: MonthRow[] }) {
  const { t } = useT();
  const [hover, setHover] = useState<number | null>(null);

  const W = 880, H = 170, padL = 28, padR = 6, padT = 12, padB = 22;
  const max = Math.max(1, ...data.map((d) => Math.max(Number(d.frozen), Number(d.destroyed))));
  const n = data.length || 1;
  const groupW = (W - padL - padR) / n;
  const barW = Math.max(1.5, Math.min(10, groupW / 2 - 1));
  const labelStep = Math.max(1, Math.ceil(n / 14));
  const plotH = H - padT - padB;
  const yOf = (v: number) => padT + plotH * (1 - v / max);
  const hOf = (v: number) => plotH * (v / max);

  const tipLeft = hover === null ? 0 : Math.min(94, Math.max(6, ((padL + hover * groupW + groupW / 2) / W) * 100));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="monthly activity">
        <text x={2} y={padT + 7} className="fill-neutral-600 text-[9px]">{max}</text>
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} className="stroke-white/10" strokeWidth={1} />
        {data.map((d, i) => {
          const x = padL + i * groupW;
          const f = Number(d.frozen), de = Number(d.destroyed);
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
          <div className="text-amber-300">{t('legendFrozen')}: {Number(data[hover].frozen).toLocaleString()}</div>
          <div className="text-red-300">{t('legendDestroyed')}: {Number(data[hover].destroyed).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

export default function Charts() {
  const { t } = useT();
  const [data, setData] = useState<MonthRow[] | null>(null);

  useEffect(() => {
    fetch('/api/frozen/timeline').then((r) => r.json()).then((d) => setData(d.monthly ?? [])).catch(() => {});
  }, []);

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-neutral-500">{t('chartMonthly')}</div>
      {data ? <MonthlyChart data={data} /> : <div className="h-[170px] animate-pulse rounded bg-white/5" />}
      <div className="mt-2 flex gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-400/70" />{t('legendFrozen')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-400/70" />{t('legendDestroyed')}</span>
      </div>
    </section>
  );
}
