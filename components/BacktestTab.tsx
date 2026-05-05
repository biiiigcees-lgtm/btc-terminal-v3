"use client";
// components/BacktestTab.tsx — Historical signal performance analysis

import { useEffect } from "react";
import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function BacktestTab() {
  const { backtestResult, backtestLoading, backtestError, setBacktestResult, setBacktestLoading, setBacktestError } = useTerminal();

  async function runBacktest() {
    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const res = await fetch("/api/backtest", { cache: "no-store" });
      if (!res.ok) throw new Error("Backtest failed");
      setBacktestResult(await res.json());
    } catch (e) {
      setBacktestError(String(e));
      setBacktestLoading(false);
    }
  }

  useEffect(() => {
    if (!backtestResult && !backtestLoading) runBacktest();
  }, []);

  const r = backtestResult;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">BACKTEST</h1>
          <p className="text-dim text-xs font-mono mt-0.5">Signal accuracy vs last 200 candles · Alpha ≥ 70 · All gates applied</p>
        </div>
        <button
          onClick={runBacktest}
          disabled={backtestLoading}
          className="px-4 py-2 bg-accent/10 border border-accent/40 text-accent text-xs font-mono rounded-lg hover:bg-accent/20 transition-all disabled:opacity-40"
        >
          {backtestLoading ? "Running..." : "↻ Re-run"}
        </button>
      </div>

      {backtestLoading && (
        <div className="bg-panel border border-border rounded-xl p-12 text-center">
          <div className="text-accent font-mono text-sm animate-pulse">Running backtest on historical candles...</div>
          <div className="text-dim font-mono text-xs mt-2">Applying full signal engine to each 15-min candle</div>
        </div>
      )}

      {backtestError && (
        <div className="bg-red/10 border border-red/30 rounded-xl p-4 text-red font-mono text-sm">{backtestError}</div>
      )}

      {r && !backtestLoading && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Win Rate", value: `${r.winRate}%`, color: r.winRate >= 55 ? "text-green" : r.winRate >= 50 ? "text-amber" : "text-red", sub: `${r.wins}W / ${r.losses}L` },
              { label: "Total Trades", value: r.totalTrades, color: "text-text", sub: "Gates applied" },
              { label: "Net P&L", value: `${r.netPnl >= 0 ? "+" : ""}$${r.netPnl.toFixed(2)}`, color: r.netPnl >= 0 ? "text-green" : "text-red", sub: "$1/trade normalized" },
              { label: "Max Drawdown", value: `$${r.maxDrawdown.toFixed(2)}`, color: r.maxDrawdown > 5 ? "text-red" : "text-amber", sub: "From peak" },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="bg-panel border border-border rounded-xl p-4">
                <div className="text-dim text-xs font-mono uppercase">{label}</div>
                <div className={clsx("text-2xl font-mono font-bold mt-1 num", color)}>{value}</div>
                <div className="text-dim text-[10px] font-mono mt-1">{sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Sharpe + best insights */}
            <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
              <div className="text-dim text-xs font-mono uppercase tracking-widest">Key Insights</div>
              {[
                { label: "Sharpe Ratio", value: r.sharpeRatio.toFixed(2), color: r.sharpeRatio > 0.5 ? "text-green" : r.sharpeRatio > 0 ? "text-amber" : "text-red" },
                { label: "Best Hour (UTC)", value: `${r.bestHour}:00`, color: "text-green" },
                { label: "Worst Hour (UTC)", value: `${r.worstHour}:00`, color: "text-red" },
                { label: "Best Alpha Bracket", value: r.bestAlphaBracket, color: "text-gold" },
                { label: "Peak P&L", value: `$${r.peakPnl.toFixed(2)}`, color: "text-green" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center border-b border-border/30 pb-2 last:border-0 last:pb-0">
                  <span className="text-dim text-xs font-mono">{label}</span>
                  <span className={clsx("text-sm font-mono font-bold num", color)}>{value}</span>
                </div>
              ))}
            </div>

            {/* Alpha bracket breakdown */}
            <div className="bg-panel border border-border rounded-xl p-4">
              <div className="text-dim text-xs font-mono uppercase tracking-widest mb-3">Win Rate by Alpha Score</div>
              <div className="space-y-2">
                {Object.entries(r.byAlphaBracket).map(([bracket, stats]) => (
                  <div key={bracket}>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-dim">{bracket}</span>
                      <span className={clsx(stats.winRate >= 55 ? "text-green" : stats.winRate >= 50 ? "text-amber" : "text-red")}>
                        {stats.winRate}% ({stats.trades} trades)
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className={clsx("h-full rounded-full", stats.winRate >= 55 ? "bg-green" : stats.winRate >= 50 ? "bg-amber" : "bg-red")}
                        style={{ width: `${stats.winRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hourly heatmap */}
          <div className="bg-panel border border-border rounded-xl p-4">
            <div className="text-dim text-xs font-mono uppercase tracking-widest mb-3">Historical Win Rate by Hour (UTC)</div>
            <div className="flex gap-0.5 items-end">
              {Array.from({ length: 24 }, (_, h) => {
                const stats = r.byHour[h];
                const total = stats ? stats.wins + stats.losses : 0;
                const wr = total > 0 ? stats.winRate : 0;
                const height = total > 0 ? Math.max(16, (wr / 100) * 48) : 8;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={clsx("w-full rounded-sm transition-all",
                        total === 0 ? "bg-surface" : wr >= 60 ? "bg-green/70" : wr >= 50 ? "bg-amber/70" : "bg-red/70"
                      )}
                      style={{ height: `${height}px` }}
                      title={`${h}:00 UTC — ${total === 0 ? "No data" : `${stats.wins}W/${stats.losses}L (${wr}%)`}`}
                    />
                    {h % 4 === 0 && <div className="text-[8px] text-dim font-mono">{h}h</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent backtest trades */}
          <div className="bg-panel border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-dim text-xs font-mono uppercase">Last {r.trades.length} Backtest Trades</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/50 text-dim text-[10px]">
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Direction</th>
                    <th className="px-3 py-2 text-left">Alpha</th>
                    <th className="px-3 py-2 text-right">Entry</th>
                    <th className="px-3 py-2 text-right">Exit</th>
                    <th className="px-3 py-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {r.trades.slice(0, 20).map((t, i) => (
                    <tr key={i} className="border-b border-border/20 last:border-0">
                      <td className="px-3 py-2 text-dim">{new Date(t.time * 1000).toLocaleTimeString()}</td>
                      <td className={clsx("px-3 py-2 font-bold", t.direction === "ABOVE" ? "text-green" : "text-red")}>
                        {t.direction === "ABOVE" ? "▲" : "▽"} {t.direction}
                      </td>
                      <td className={clsx("px-3 py-2", t.alpha >= 80 ? "text-green" : t.alpha >= 70 ? "text-amber" : "text-dim")}>{t.alpha}</td>
                      <td className="px-3 py-2 text-right text-dim num">${t.entryPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-dim num">${t.exitPrice.toLocaleString()}</td>
                      <td className={clsx("px-3 py-2 text-right font-bold", t.result === "WIN" ? "text-green" : "text-red")}>
                        {t.result}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
