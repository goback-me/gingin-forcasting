// Assigns a market stall name to Market-channel products. There's no real
// per-market source column yet, so this deterministically spreads products
// across a few dummy market names -- deterministic (hashed on PLU) rather
// than Math.random() so the same product always lands in the same market
// on every re-import, instead of jumping around each time the file is
// re-imported. Swap this out once a real "Market Name" column exists in
// the source file -- see weeklySource.ts, which already checks for one
// first and only falls back to this when it's missing.
const DUMMY_MARKET_NAMES = ["Market 1", "Market 2", "Market 3"];

export function assignDummyMarket(productKey: string): string {
  let hash = 0;
  for (let i = 0; i < productKey.length; i++) {
    hash = (hash * 31 + productKey.charCodeAt(i)) >>> 0;
  }
  return DUMMY_MARKET_NAMES[hash % DUMMY_MARKET_NAMES.length];
}
