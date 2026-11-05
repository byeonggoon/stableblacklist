'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { HACK_EVENTS } from '@/lib/events';

interface MonthRow { month: string; frozen: number; destroyed: number; frozenUsd: number; destroyedUsd: number }
type Mode = 'count' | 'usd';
type View = [number, number];

// $1.2B / $340M / $12K 처럼 축·툴팁용 축약
const fmtUsdShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const MIN_COLS = 6; // 최대 확대 시 보이는 달 수

function MonthlyChart({ data, mode, view, setView }: {
  data: MonthRow[]; mode: Mode; view: View; setView: (fn: (v: View) => View) => void;
}) {
  const { t } = useT();
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; view: View } | null>(null);

  const W = 880, H = 170, padL = mode === 'usd' ? 40 : 28, padR = 6, padT = 30, padB = 22;
  const vis = data.slice(view[0], view[1]);
  const fOf = (d: MonthRow) => Number(mode === 'usd' ? d.frozenUsd : d.frozen);
  const dOf = (d: MonthRow) => Number(mode === 'usd' ? d.destroyedUsd : d.destroyed);
  const fmt = (v: number) => (mode === 'usd' ? fmtUsdShort(v) : v.toLocaleString());
  // y축은 보이는 구간 기준 → 확대하면 작은 달도 잘 보인다
  const max = Math.max(1, ...vis.map((d) => Math.max(fOf(d), dOf(d))));
  const n = vis.length || 1;
  const groupW = (W - padL - padR) / n;
  const barW = Math.max(1.5, Math.min(24, groupW / 2 - 1));
  const labelStep = Math.max(1, Math.ceil(n / 14));
  const plotH = H - padT - padB;
  const yOf = (v: number) => padT + plotH * (1 - v / max);
  const hOf = (v: number) => plotH * (v / max);

  // 휠/핀치 확대: 커서 위치의 달을 고정점으로. React onWheel 은 passive 라 직접 등록
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (((e.clientX - r.left) / r.width) * W - padL) / (W - padL - padR)));
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setView((v) => shift(v, (e.deltaX / r.width) * (v[1] - v[0]), data.length));
      } else {
        setView((v) => zoomView(v, Math.exp(e.deltaY * 0.004), frac, data.length));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [padL, data.length, setView]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, view };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const cols = (-(e.clientX - d.x) / e.currentTarget.getBoundingClientRect().width) * W / groupW;
    if (Math.abs(cols) >= 0.5) setHover(null);
    setView(() => shift(d.view, cols, data.length));
  };
  const endDrag = () => { drag.current = null; };

  // 사건이 있는 달의 열 인덱스. 라벨이 겹치지 않게 위/아래 두 줄로 번갈아 놓는다
  const events = HACK_EVENTS
    .map((e) => ({ ...e, i: vis.findIndex((d) => d.month === e.date.slice(0, 7)) }))
    .filter((e) => e.i >= 0);
  const eventsAt = (i: number) => events.filter((e) => e.i === i);

  const tipLeft = hover === null ? 0 : Math.min(94, Math.max(6, ((padL + hover * groupW + groupW / 2) / W) * 100));

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
        role="img" aria-label="monthly activity"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onDoubleClick={() => setView(() => [0, data.length])}>
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
        {vis.map((d, i) => {
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
        {vis.map((d, i) => (
          <rect key={`h-${d.month}`} x={padL + i * groupW} y={padT} width={groupW} height={plotH}
            fill="transparent" onMouseEnter={() => !drag.current && setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>

      {hover !== null && vis[hover] && (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-white/15 bg-neutral-900/95 px-2 py-1 text-[11px] shadow-lg"
          style={{ left: `${tipLeft}%` }}>
          <div className="font-mono text-neutral-200">{vis[hover].month}</div>
          <div className="text-amber-300">{t('legendFrozen')}: {fmt(fOf(vis[hover]))}</div>
          <div className="text-red-300">{t('legendDestroyed')}: {fmt(dOf(vis[hover]))}</div>
          {eventsAt(hover).map((e) => (
            <div key={e.date} className="mt-0.5 whitespace-nowrap text-sky-300">{e.date} {e.name} {t('eventHack')} ({e.stolen})</div>
          ))}
        </div>
      )}
    </div>
  );
}

// 보이는 구간 [시작, 끝) 을 cols 만큼 이동 (데이터 범위 안으로 고정)
function shift([s, e]: View, cols: number, total: number): View {
  const len = e - s;
  const ns = Math.min(total - len, Math.max(0, Math.round(s + cols)));
  return [ns, ns + len];
}

// factor < 1 이면 확대. frac(0~1) 위치의 달이 제자리에 남도록 시작점을 맞춘다
function zoomView([s, e]: View, factor: number, frac: number, total: number): View {
  const len = e - s;
  const nl = Math.min(total, Math.max(Math.min(MIN_COLS, total), Math.round(len * factor)));
  if (nl === len) return [s, e];
  const ns = Math.min(total - nl, Math.max(0, Math.round(s + frac * len - frac * nl)));
  return [ns, ns + nl];
}

export default function Charts() {
  const { t } = useT();
  const [data, setData] = useState<MonthRow[] | null>(null);
  const [mode, setMode] = useState<Mode>('count');
  const [view, setViewState] = useState<View>([0, 0]);
  const setView = useCallback((fn: (v: View) => View) => setViewState(fn), []);

  useEffect(() => {
    fetch('/api/frozen/timeline').then((r) => r.json()).then((d) => {
      const rows: MonthRow[] = d.monthly ?? [];
      setData(rows);
      setViewState([0, rows.length]);
    }).catch(() => {});
  }, []);

  const total = data?.length ?? 0;
  const zoomed = view[1] - view[0] < total;
  const zoomBtn = 'rounded-md px-2 py-1 text-neutral-400 hover:bg-white/5 hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex gap-1 text-[11px]">
        {(['count', 'usd'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-md px-2.5 py-1 transition-colors ${mode === m ? 'bg-white/10 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>
            {t(m === 'usd' ? 'chartMonthlyUsd' : 'chartMonthly')}
          </button>
        ))}
        {data && (
          <div className="ml-auto flex items-center gap-1">
            {zoomed && <span className="mr-1 font-mono text-[10px] text-neutral-500">{data[view[0]]?.month} ~ {data[view[1] - 1]?.month}</span>}
            <button type="button" className={zoomBtn} aria-label={t('zoomIn')} title={t('zoomIn')}
              disabled={view[1] - view[0] <= Math.min(MIN_COLS, total)}
              onClick={() => setView((v) => zoomView(v, 0.6, 1, total))}>＋</button>
            <button type="button" className={zoomBtn} aria-label={t('zoomOut')} title={t('zoomOut')}
              disabled={!zoomed} onClick={() => setView((v) => zoomView(v, 1 / 0.6, 1, total))}>－</button>
            <button type="button" className={zoomBtn} disabled={!zoomed} onClick={() => setView(() => [0, total])}>{t('zoomReset')}</button>
          </div>
        )}
      </div>
      {data ? <MonthlyChart data={data} mode={mode} view={view} setView={setView} /> : <div className="h-[170px] animate-pulse rounded bg-white/5" />}
      <div className="mt-2 flex gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-400/70" />{t('legendFrozen')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-400/70" />{t('legendDestroyed')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-0 border-l border-dashed border-sky-400/70" />{t('legendHack')}</span>
        <span className="ml-auto hidden text-neutral-600 sm:inline">{mode === 'usd' ? t('chartUsdNote') : t('zoomHint')}</span>
      </div>
    </section>
  );
}
