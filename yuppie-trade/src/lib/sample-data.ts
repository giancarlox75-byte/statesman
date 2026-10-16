/**
 * Deterministic SAMPLE data for marketing previews. Not market data, not
 * performance of any real account. Anything rendering this must say so.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleSeries(points: number, seed: number, start = 100, drift = 0.0012, vol = 0.012) {
  const rand = mulberry32(seed);
  const out: number[] = [start];
  for (let i = 1; i < points; i++) {
    const shock = (rand() - 0.5) * 2 * vol;
    out.push(out[i - 1] * (1 + drift + shock));
  }
  return out;
}

export type Candle = { o: number; h: number; l: number; c: number };

export function sampleCandles(count: number, seed: number): Candle[] {
  const rand = mulberry32(seed);
  const out: Candle[] = [];
  let prev = 100;
  for (let i = 0; i < count; i++) {
    const o = prev;
    const c = o * (1 + (rand() - 0.46) * 0.05);
    const h = Math.max(o, c) * (1 + rand() * 0.015);
    const l = Math.min(o, c) * (1 - rand() * 0.015);
    out.push({ o, h, l, c });
    prev = c;
  }
  return out;
}

export const sampleAgents = [
  { name: "Trend Follow 20/50", market: "SPY · 1D", state: "Paper Trading", pnl: 2.14 },
  { name: "RSI Mean Reversion", market: "QQQ · 1H", state: "Testing", pnl: null },
  { name: "Opening Range Breakout", market: "AAPL · 5m", state: "Paused", pnl: -0.62 },
  { name: "Volatility Filter Draft", market: "IWM · 1D", state: "Draft", pnl: null },
] as const;
