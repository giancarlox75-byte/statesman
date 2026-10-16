import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  FlaskConical,
  History,
  Info,
  LayoutGrid,
  Lock,
  Plug,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { Sparkline } from "@/components/ui/Sparkline";
import { sampleAgents, sampleSeries } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

/**
 * Static, non-interactive picture of the product dashboard filled with
 * SAMPLE data. Exposed to assistive tech as a single labeled image so it
 * can't be mistaken for working controls or a real account.
 */

const balance = sampleSeries(60, 20, 100_000, 0.0004, 0.006);
const pnl = balance.map((v) => v - balance[0]);
const last = balance[balance.length - 1];
const change = ((last - balance[0]) / balance[0]) * 100;
const pnlTotal = last - balance[0];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const stateTone: Record<string, string> = {
  "Paper Trading": "border-pos/30 bg-pos/10 text-pos",
  Testing: "border-[#6b8cff]/30 bg-[#6b8cff]/10 text-[#9db1ff]",
  Paused: "border-warn/30 bg-warn/10 text-warn",
  Draft: "border-line bg-elevated text-muted",
};

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof LayoutGrid;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px]",
        active ? "border border-pos/25 bg-pos/10 text-fg" : "border border-transparent text-muted",
      )}
    >
      <Icon size={15} className={active ? "text-pos" : ""} />
      {label}
    </span>
  );
}

function Chip({ icon: Icon, label, active }: { icon: typeof Bell; label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
        active ? "border-pos/30 bg-pos/10 text-pos" : "border-line bg-elevated/50 text-muted",
      )}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Preview of the Yuppie Trade dashboard showing a simulated paper-trading account with sample data."
      className={cn(
        "relative select-none overflow-hidden rounded-xl border border-line bg-[#0e1115] p-2 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)]",
        className,
      )}
    >
      <div className="grid gap-2 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <div className="hidden flex-col rounded-lg border border-line bg-card p-3 md:flex">
          <div className="flex items-center gap-2 px-2 pb-4 pt-1">
            <LogoMark className="h-6 w-6 text-fg" />
            <Wordmark className="scale-90 origin-left" />
          </div>
          <span className="flex items-center gap-2 rounded-md border border-line bg-bg/60 px-3 py-2 text-xs text-subtle">
            <Search size={13} /> Search symbol or strategy
          </span>
          <p className="mt-5 px-3 pb-2 text-[10px] font-medium tracking-[0.14em] text-subtle">PLATFORM</p>
          <div className="space-y-0.5">
            <NavItem icon={LayoutGrid} label="Overview" active />
            <NavItem icon={Sparkles} label="AI Strategy Lab" />
            <NavItem icon={Bot} label="My Agents" />
            <NavItem icon={FlaskConical} label="Backtesting" />
            <NavItem icon={History} label="Trade History" />
          </div>
          <p className="mt-5 px-3 pb-2 text-[10px] font-medium tracking-[0.14em] text-subtle">INTEGRATIONS</p>
          <span className="flex items-center justify-between rounded-md border border-line bg-elevated/60 px-3 py-2 text-[13px] text-fg">
            <span className="flex items-center gap-2">
              <Plug size={14} className="text-muted" /> Demo Broker
            </span>
            <span className="rounded border border-[#6b8cff]/30 px-1.5 text-[10px] text-[#9db1ff]">DEMO</span>
          </span>
          <div className="mt-auto pt-6">
            <NavItem icon={Settings} label="Settings" />
          </div>
        </div>

        {/* Main */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Chip icon={Bell} label="Alerts" />
              <Chip icon={Activity} label="Activity" active />
              <span className="ml-1 hidden items-center gap-1.5 rounded-md border border-warn/30 bg-warn/10 px-2 py-1 text-[11px] font-medium text-warn sm:flex">
                <Info size={12} /> SAMPLE DATA
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-md bg-pos px-3 py-1.5 text-xs font-medium text-pos-ink sm:block">
                Connect Integration
              </span>
              <span className="hidden text-right leading-tight lg:block">
                <span className="block text-xs text-fg">Demo Workspace</span>
                <span className="block text-[11px] text-subtle">Paper mode</span>
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-elevated text-[11px] text-muted">
                DW
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-lg font-medium text-fg sm:text-xl">Overview</p>
                <p className="mt-1 text-xs text-muted sm:text-[13px]">
                  Simulated paper account. Sample figures — no real money involved.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 rounded-md border border-line bg-elevated/50 px-2.5 py-1.5 text-muted">
                  <span className="rounded bg-pos/15 px-1.5 text-pos">Paper</span>
                  <span className="flex items-center gap-1 text-subtle">
                    <Lock size={11} /> Live
                  </span>
                </span>
                <span className="hidden items-center gap-1.5 rounded-md border border-line bg-elevated/50 px-2.5 py-1.5 text-muted sm:flex">
                  <SlidersHorizontal size={12} /> View <ChevronDown size={12} />
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-4 py-3">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-fg">Paper Acct · DEMO-001</span>
                <span className="rounded border border-pos/30 bg-pos/10 px-1.5 py-0.5 text-[11px] text-pos">
                  Paper Trading
                </span>
                <span className="hidden rounded border border-line bg-elevated px-1.5 py-0.5 text-[11px] text-muted sm:inline">
                  Simulated
                </span>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-subtle">Overview</span>
                <span className="text-fg">Strategy Performance</span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.6fr]">
              <div className="rounded-lg border border-line bg-elevated/40 p-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Simulated P/L · 1M</span>
                  <span className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-pos" /> Within limits
                  </span>
                </div>
                <p className={cn("tabular mt-2 text-2xl font-medium", pnlTotal >= 0 ? "text-fg" : "text-neg")}>
                  {pnlTotal >= 0 ? "+" : "−"}
                  {usd(Math.abs(pnlTotal))}
                </p>
                <Sparkline data={pnl} positive={pnl[pnl.length - 1] >= pnl[0]} height={70} className="mt-3 h-16 w-full" />
              </div>
              <div className="rounded-lg border border-line bg-elevated/40 p-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Paper Balance</span>
                  <span className="flex gap-0.5 rounded-md border border-line p-0.5 text-[11px]">
                    {["1D", "1W", "1M", "YTD"].map((r) => (
                      <span key={r} className={cn("rounded px-2 py-0.5", r === "1M" ? "bg-elevated text-fg" : "text-subtle")}>
                        {r}
                      </span>
                    ))}
                  </span>
                </div>
                <p className="tabular mt-2 flex items-baseline gap-2 text-2xl font-medium text-fg">
                  {usd(last)}
                  <span className={cn("rounded px-1.5 py-0.5 text-xs", change >= 0 ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg")}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(2)}%
                  </span>
                </p>
                <Sparkline data={balance} positive={change >= 0} height={70} className="mt-3 h-16 w-full" />
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-line">
              <div className="grid grid-cols-[1.6fr_1fr_0.7fr] gap-3 border-b border-line bg-elevated/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-subtle sm:grid-cols-[1.6fr_1fr_1fr_0.7fr]">
                <span>Agent</span>
                <span className="hidden sm:block">Market</span>
                <span>State</span>
                <span className="text-right">Sim. P/L</span>
              </div>
              {sampleAgents.map((a) => (
                <div
                  key={a.name}
                  className="grid grid-cols-[1.6fr_1fr_0.7fr] items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0 sm:grid-cols-[1.6fr_1fr_1fr_0.7fr]"
                >
                  <span className="truncate text-fg">{a.name}</span>
                  <span className="hidden text-muted sm:block">{a.market}</span>
                  <span>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[11px]", stateTone[a.state])}>{a.state}</span>
                  </span>
                  <span
                    className={cn(
                      "tabular text-right",
                      a.pnl === null ? "text-subtle" : a.pnl >= 0 ? "text-pos" : "text-neg",
                    )}
                  >
                    {a.pnl === null ? "—" : `${a.pnl > 0 ? "+" : ""}${a.pnl.toFixed(2)}%`}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
              <BarChart3 size={12} /> Illustrative sample data for product preview only. Not actual or
              hypothetical trading results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
