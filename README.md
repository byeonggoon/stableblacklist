# StableBlacklist

스테이블코인 발행사 동결(Tether · Circle)과 소각, 그리고 제재 주소를 **온체인 이벤트 기반**으로 추적하는 공개 인텔리전스 대시보드.

현재 추적 중인 **동결 잔액 합계: ~$3.1B** (USDT-ETH · USDC-ETH · USDT-Tron).

## 무엇을 하나

- **발행사 동결/소각 추적** — Tether/Circle 의 블랙리스트 이벤트를 1분~15분 주기로 인덱싱
- **정확한 상태 모델** — `frozen` / `destroyed` / `unfrozen` 상태머신. `balanceOf` 가 0이라고 "소각"으로 추론하지 않고, **`DestroyedBlackFunds` 이벤트가 실제 발생한 경우에만** 소각으로 기록하고 소각 금액·시각을 보존한다.
- **대시보드** — 동결 잔액 합계, 상태별·체인별 분포, 필터·정렬·검색·페이지네이션 테이블

## 핵심 설계 포인트

- **이벤트 디코딩이 토큰마다 다르다** — USDT(Tether) 의 `AddedBlackList`/`DestroyedBlackFunds` 는 파라미터가 `indexed` 가 아니라 **`data`** 에 들어있고, USDC(Circle) 의 `Blacklisted` 는 `indexed` 라 **`topics`** 에 있다. (실데이터로 검증)
- **이벤트 소싱 상태머신** — 로그를 (block, logIndex) 순으로 정렬해 순차 전이. 동결+소각이 같은 블록에 발생해도 순서가 보장된다.
- **체인별 주소 정규화** — EVM 은 lowercase hex, Tron 은 Base58Check(대소문자 보존).
- **순수 로직 분리 + 단위 테스트** — 이벤트 디코더와 상태 전이는 네트워크/DB 의존 없는 순수 함수로 테스트.

## 아키텍처

```
Etherscan(EVM logs) / TronGrid(events)
  → 디코더 (events.ts: USDT=data / USDC=topics)
  → 상태머신 (state-machine.ts: applyEvent)
  → Supabase (sbl_frozen_wallets)
  → list/stats API → 대시보드
크론(GitHub Actions ~15분 + Vercel 일일) → /api/cron/sync
```

## 기술 스택

Next.js 16 (App Router) · TypeScript (strict) · viem · Supabase · Vitest · Tailwind · Vercel

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local   # 키 채우기 (Supabase, Etherscan, Alchemy, TronGrid, CRON_SECRET)
# Supabase SQL Editor 에 supabase/schema.sql 적용
npm run dev
# 인덱서 1회 실행:
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

테스트 / 타입체크 / 린트:

```bash
npm test && npx tsc --noEmit && npm run lint
```

## 배포 & 지속 업데이트

1. Vercel 에 import → 환경변수 6개 입력 (`.env.local` 키와 동일)
2. Supabase SQL Editor 에 `supabase/schema.sql` 적용
3. 지속 갱신: GitHub Actions(`.github/workflows/sync.yml`)가 `*/15` 마다 배포된 `/api/cron/sync` 호출
   - GitHub repo secrets: `DEPLOY_URL`, `CRON_SECRET`
   - 백업으로 Vercel Cron 이 하루 1회 실행

## 라이선스 / 면책

공개된 온체인 데이터를 중립적으로 집계합니다. 투자/법률 자문이 아닙니다.
