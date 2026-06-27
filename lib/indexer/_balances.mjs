/**
 * Shared balance-fetch utilities for frozen wallet scripts.
 *   ETH  — Multicall3 aggregate3 batched balanceOf
 *   Tron — TronGrid triggerconstantcontract balanceOf
 * Used by fetch-eth-blacklists, fetch-tron-balances, refetch-zero-balances.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ─── Common ───────────────────────────────────────────────────────────────

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function getEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    const m = env.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (m) return m[1].trim();
  } catch { /* ignore */ }
  return "";
}

export function getSupabase() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) { console.error("Missing Supabase credentials"); process.exit(1); }
  return createClient(url, key);
}

// ─── ETH: Multicall3 ────────────────────────────────────────────────────────

export const ETH_USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const ETH_USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MULTICALL3      = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL_BATCH = 200;
const BALANCE_OF_SEL  = "70a08231";
const AGGREGATE3_SEL  = "82ad56cb";

function padAddress(a) { return a.replace("0x", "").padStart(64, "0"); }
function encodeBalanceOf(a) { return "0x" + BALANCE_OF_SEL + padAddress(a); }

function encodeAggregate3(calls) {
  let data = AGGREGATE3_SEL;
  data += "0000000000000000000000000000000000000000000000000000000000000020";
  data += calls.length.toString(16).padStart(64, "0");
  const encodedCalls = [];
  for (const call of calls) {
    const cdHex = call.callData.replace("0x", "");
    const cdLen = cdHex.length / 2;
    const padded = cdHex.padEnd(Math.ceil(cdHex.length / 64) * 64, "0");
    let enc = "";
    enc += padAddress(call.target);
    enc += "0000000000000000000000000000000000000000000000000000000000000001";
    enc += "0000000000000000000000000000000000000000000000000000000000000060";
    enc += cdLen.toString(16).padStart(64, "0");
    enc += padded;
    encodedCalls.push(enc);
  }
  let offset = calls.length * 32;
  const offsets = [];
  for (const enc of encodedCalls) { offsets.push(offset.toString(16).padStart(64, "0")); offset += enc.length / 2; }
  data += offsets.join("") + encodedCalls.join("");
  return "0x" + data;
}

function decodeAggregate3Result(hexData) {
  const d = hexData.replace("0x", "");
  const len = parseInt(d.slice(64, 128), 16);
  const start = 64;
  const offs = [];
  for (let i = 0; i < len; i++) { const p = start + 64 + i * 64; offs.push(parseInt(d.slice(p, p + 64), 16)); }
  const results = [];
  for (let i = 0; i < len; i++) {
    const ts = start + 64 + offs[i] * 2;
    const success = parseInt(d.slice(ts, ts + 64), 16) === 1;
    const rdo = parseInt(d.slice(ts + 64, ts + 128), 16);
    const rds = ts + rdo * 2;
    const rdl = parseInt(d.slice(rds, rds + 64), 16);
    const returnData = d.slice(rds + 64, rds + 64 + rdl * 2);
    results.push({ success, returnData });
  }
  return results;
}

function parseBalance(hex) {
  if (!hex) return 0;
  return Number(BigInt("0x" + hex)) / 1e6;
}

/** Batched balanceOf via Multicall3. Returns Map<address, number>. Failed batches → 0. */
export async function fetchEthBalances(addresses, tokenContract, rpcUrl) {
  const balances = new Map();
  for (let i = 0; i < addresses.length; i += MULTICALL_BATCH) {
    const chunk = addresses.slice(i, i + MULTICALL_BATCH);
    const batchNum = Math.floor(i / MULTICALL_BATCH) + 1;
    const total = Math.ceil(addresses.length / MULTICALL_BATCH);
    console.log(`  batch ${batchNum}/${total} (${chunk.length} addrs)`);
    const calls = chunk.map((a) => ({ target: tokenContract, allowFailure: true, callData: encodeBalanceOf(a) }));
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: MULTICALL3, data: encodeAggregate3(calls) }, "latest"] }),
      });
      const json = await res.json();
      if (json.error) { for (const a of chunk) balances.set(a, 0); continue; }
      const results = decodeAggregate3Result(json.result);
      for (let j = 0; j < chunk.length; j++) {
        balances.set(chunk[j], (j < results.length && results[j].success) ? parseBalance(results[j].returnData) : 0);
      }
    } catch { for (const a of chunk) balances.set(a, 0); }
    if (i + MULTICALL_BATCH < addresses.length) await sleep(100);
  }
  return balances;
}

// ─── Tron: TronGrid ─────────────────────────────────────────────────────────

export const TRON_USDT_CONTRACT_HEX = "41a614f803b6fd780986a42c78ec9c7f77e6ded13c";
const TRONGRID_BASE = "https://api.trongrid.io";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58ToHex(base58Addr) {
  let num = 0n;
  for (const char of base58Addr) num = num * 58n + BigInt(BASE58_ALPHABET.indexOf(char));
  const hex = num.toString(16).padStart(50, "0");
  return hex.slice(2, 42);
}

/** Single Tron USDT balanceOf. Returns number, or null on failure (for retry). */
export async function fetchTronBalance(address) {
  const addrHex = base58ToHex(address);
  const parameter = addrHex.padStart(64, "0");
  try {
    const res = await fetch(`${TRONGRID_BASE}/wallet/triggerconstantcontract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_address: "410000000000000000000000000000000000000000",
        contract_address: TRON_USDT_CONTRACT_HEX,
        function_selector: "balanceOf(address)",
        parameter,
        visible: false,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.constant_result?.[0];
    if (!result) return null;
    return Number(BigInt("0x" + result)) / 1e6;
  } catch {
    return null;
  }
}

/** Tron balanceOf with 3 retries (backoff). Returns 0 if all fail. */
export async function fetchTronBalanceWithRetry(address) {
  for (let i = 0; i < 3; i++) {
    const bal = await fetchTronBalance(address);
    if (bal !== null) return bal;
    await sleep(1000 * (i + 1));
  }
  return 0;
}
