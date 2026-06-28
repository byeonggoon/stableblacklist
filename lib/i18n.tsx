'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'ko' | 'en';

const dict = {
  ko: {
    tagline: 'freeze · destroy · sanctions tracker',
    desc: '스테이블코인 발행사 동결(Tether·Circle)과 소각을 온체인 이벤트로 추적합니다. balanceOf 로 추론하지 않고 DestroyedBlackFunds 이벤트가 실제 발생한 경우에만 소각으로 기록합니다.',
    lastUpdated: '마지막 갱신',
    statTotalLabel: '현재 동결 잔액 합계',
    statTotalSub: '살아있는(미소각) 동결 자산',
    statFrozen: '동결 주소',
    statDestroyed: '소각 주소',
    statUnfrozen: '해제 주소',
    addressesFrozen: '개 주소 동결중',
    footer: '데이터 출처: Etherscan · Tron · 발행사 온체인 이벤트 — StableBlacklist',
    tabFrozen: '동결 (frozen)',
    tabDestroyed: '소각 (destroyed)',
    tabUnfrozen: '해제 (unfrozen)',
    all: '전체',
    searchPlaceholder: '주소 검색',
    colAddress: '주소',
    colTokenChain: '토큰 / 체인',
    colStatus: '상태',
    colBalance: '잔액',
    colBurned: '소각 금액',
    colFrozenAt: '동결일',
    colBurnedAt: '소각일',
    colChain: '체인',
    colSource: '출처',
    colEntity: '제재 대상 / 프로그램',
    viewFrozen: '발행사 동결',
    viewSanctions: 'OFAC 제재',
    viewBoth: '교차',
    statSanctioned: 'OFAC 제재 주소',
    chartMonthly: '월별 동결·소각 추이',
    chartGap: '동결 → 소각 시차',
    legendFrozen: '동결',
    legendDestroyed: '소각',
    prev: '이전',
    next: '다음',
    loading: '불러오는 중…',
    empty: '조건에 맞는 주소가 없습니다',
    error: '데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.',
  },
  en: {
    tagline: 'freeze · destroy · sanctions tracker',
    desc: 'Tracks stablecoin issuer freezes (Tether·Circle) and burns through on-chain events. It never infers from balanceOf — a burn is recorded only when a DestroyedBlackFunds event actually fires.',
    lastUpdated: 'Last updated',
    statTotalLabel: 'Total frozen balance',
    statTotalSub: 'Live (un-destroyed) frozen assets',
    statFrozen: 'Frozen addresses',
    statDestroyed: 'Destroyed addresses',
    statUnfrozen: 'Unfrozen addresses',
    addressesFrozen: 'addresses frozen',
    footer: 'Data: Etherscan · Tron · issuer on-chain events — StableBlacklist',
    tabFrozen: 'Frozen',
    tabDestroyed: 'Destroyed',
    tabUnfrozen: 'Unfrozen',
    all: 'All',
    searchPlaceholder: 'Search address',
    colAddress: 'Address',
    colTokenChain: 'Token / Chain',
    colStatus: 'Status',
    colBalance: 'Balance',
    colBurned: 'Burned',
    colFrozenAt: 'Frozen at',
    colBurnedAt: 'Burned at',
    colChain: 'Chain',
    colSource: 'Source',
    colEntity: 'Entity / Program',
    viewFrozen: 'Issuer freeze',
    viewSanctions: 'OFAC sanctions',
    viewBoth: 'Cross-flagged',
    statSanctioned: 'OFAC sanctioned',
    chartMonthly: 'Monthly freeze & destroy',
    chartGap: 'Freeze → destroy gap',
    legendFrozen: 'Frozen',
    legendDestroyed: 'Destroyed',
    prev: 'Prev',
    next: 'Next',
    loading: 'Loading…',
    empty: 'No matching addresses',
    error: 'Failed to load. Please try again shortly.',
  },
} as const;

export type TKey = keyof (typeof dict)['ko'];

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }
const Ctx = createContext<LangCtx>({ lang: 'ko', setLang: () => {}, t: (k) => k });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ko');

  // 마운트 후 localStorage 에서 복원 (SSR 하이드레이션 불일치 방지를 위해 effect 에서)
  useEffect(() => {
    const restore = () => {
      try {
        const saved = window.localStorage.getItem('lang');
        if (saved === 'ko' || saved === 'en') setLangState(saved);
      } catch { /* localStorage 접근 불가 */ }
    };
    restore();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem('lang', l); } catch { /* ignore */ }
  };

  const t = (k: TKey) => dict[lang][k] ?? dict.ko[k] ?? k;

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
