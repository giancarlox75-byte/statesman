import { sampleCandles } from "@/lib/sample-data";

/**
 * Decorative glass-pane illustration with abstract candlesticks.
 * Purely ornamental (aria-hidden) — it does not represent any market.
 */
const panes = [
  { x: 40, seed: 3, opacity: 1 },
  { x: 150, seed: 11, opacity: 0.8 },
  { x: 240, seed: 19, opacity: 0.6 },
];

export function HeroVisual({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 460" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="hv-glass" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#8EA2FF" stopOpacity="0.20" />
          <stop offset="55%" stopColor="#7C5CFF" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#39D98A" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="hv-edge" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#39D98A" stopOpacity="0.25" />
        </linearGradient>
        <filter id="hv-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {[...panes].reverse().map((p) => {
        const w = 150;
        const top = 40 + (p.x - 40) * 0.06;
        const poly = `${p.x},${top + 34} ${p.x + w},${top} ${p.x + w},${440} ${p.x},${452}`;
        const candles = sampleCandles(9, p.seed);
        const lo = Math.min(...candles.map((c) => c.l));
        const hi = Math.max(...candles.map((c) => c.h));
        const y = (v: number) => 380 - ((v - lo) / (hi - lo)) * 250;
        const clip = `hv-clip-${p.seed}`;
        return (
          <g key={p.seed} opacity={p.opacity}>
            <clipPath id={clip}>
              <polygon points={poly} />
            </clipPath>
            <polygon points={poly} fill="url(#hv-glass)" />
            <g clipPath={`url(#${clip})`} filter="url(#hv-soft)">
              {candles.map((c, i) => {
                const cx = p.x + 18 + i * 14.5;
                const up = c.c >= c.o;
                const color = up ? "#39D98A" : "#9B7BFF";
                return (
                  <g key={i} opacity={0.85}>
                    <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1.5" />
                    <rect
                      x={cx - 4}
                      width="8"
                      y={y(Math.max(c.o, c.c))}
                      height={Math.max(4, Math.abs(y(c.o) - y(c.c)))}
                      rx="1.5"
                      fill={color}
                    />
                  </g>
                );
              })}
            </g>
            <polygon points={poly} stroke="url(#hv-edge)" strokeWidth="1.2" />
            <line x1={p.x + w} x2={p.x + w} y1={top} y2={440} stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2.5" />
          </g>
        );
      })}
    </svg>
  );
}
