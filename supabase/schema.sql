-- StableBlacklist 스키마 (옵션 A: 기존 chase-chain Supabase 재사용 → sbl_ 접두사로 격리)
-- 기존 Supabase 프로젝트의 SQL Editor 에 붙여넣고 실행.

create table if not exists sbl_frozen_wallets (
  address          text not null,
  token            text not null,            -- 'USDT' | 'USDC'
  chain            text not null,            -- 'Ethereum' | 'Tron'
  status           text not null default 'frozen', -- 'frozen' | 'destroyed' | 'unfrozen'
  balance          numeric not null default 0,     -- 현재 balanceOf (frozen일 때만 의미)
  frozen_at        timestamptz,
  destroyed_amount numeric,                   -- DestroyedBlackFunds._balance (USDT만)
  destroyed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (address, token, chain)
);

create index if not exists idx_sbl_frozen_status on sbl_frozen_wallets (status);
create index if not exists idx_sbl_frozen_token_chain on sbl_frozen_wallets (token, chain);

create table if not exists sbl_frozen_metadata (
  key   text primary key,                    -- 'lastEthBlock' | 'lastTronTimestamp'
  value text not null
);

-- status=frozen 잔액 합계 (1000행 제한 우회)
create or replace function sbl_frozen_balance_sum(p_token text, p_chain text)
returns numeric language sql stable as $$
  select coalesce(sum(balance), 0) from sbl_frozen_wallets
  where status = 'frozen'
    and (p_token = 'all' or token = p_token)
    and (p_chain = 'all' or chain = p_chain);
$$;

-- OFAC 제재 암호화폐 주소 (발행사 동결과 별개 소스)
create table if not exists sbl_sanctioned_addresses (
  address    text not null,
  chain      text not null,            -- 'Ethereum' | 'Bitcoin' | 'Tron'
  source     text not null default 'OFAC',
  updated_at timestamptz not null default now(),
  primary key (address, chain)
);
create index if not exists idx_sbl_sanctioned_chain on sbl_sanctioned_addresses (chain);
