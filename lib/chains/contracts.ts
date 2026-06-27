// 스테이블코인 컨트랙트 주소 + 블랙리스트 이벤트 topic0 상수.
// 실측 확정: USDT(Tether) 이벤트는 non-indexed → 주소가 DATA 에, USDC(Circle)는 indexed → topics[1].

export const ETH_USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
export const ETH_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// USDT (Tether) events — 주소/금액이 data 에 있음
export const TOPIC_ADDED_BLACKLIST     = '0x42e160154868087d6bfdc0ca23d96a1c1cfa32f1b72ba9ba27b69b98a0d819dc';
export const TOPIC_REMOVED_BLACKLIST   = '0xd7e9ec6e6ecd65492dce6bf513cd6867560d49544421d0783ddf06e76c24470c';
export const TOPIC_DESTROYED_BLACKFUNDS = '0x61e6e66b0d6339b2980aecc6ccc0039736791f0ccde9ed512e789a7fbdd698c6'; // keccak256("DestroyedBlackFunds(address,uint256)") — 실측 확정

// USDC (Circle) events — 주소가 topics[1] (indexed)
export const TOPIC_BLACKLISTED   = '0xffa4e6181777692565cf28528fc88fd1516ea86b56da075235fa575af6a4b855';
export const TOPIC_UNBLACKLISTED = '0x117e3210bb9aa7d9baff172026820255c6f6c30ba8999d1c2fd88e2848137c4e';
