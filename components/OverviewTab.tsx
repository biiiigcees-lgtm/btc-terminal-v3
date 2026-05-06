"use client";
// components/OverviewTab.tsx

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

function fmt(n: number, d = 0) {
  return n?.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) ?? "—";
}

export function OverviewTab() {
  const { market, signal } = useTerminal();

  const stats = [
    { label: "Spot Price", value: `$${fmt(market?.price ?? 0)}`, sub: "Composite live synth", color: "text-accent" },
    { label: "24H Change", value: `${market?.change24h?.toFixed(2) ?? "—"}%`, sub: "Daily range", color: market?.change24h ?? 0 >= 0 ? "text-green" : "text-red" },
    { label: "Prob Split", value: `${signal?.kalshiConf?.toFixed(0) ?? "—"}%`, sub: `${signal?.kalshiEdge ?? "—"} bias`, color: "text-gold" },
    { label: "Order Flow", value: signal?.indicators?.cmf ? (signal.indicators.cmf > 0 ? "BUY BIAS" : "SELL BIAS") : "—", sub: "CMF imbalance", color: (signal?.indicators?.cmf ?? 0) > 0 ? "text-green" : "text-red" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-display font-bold">OVERVIEW</h1>

      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, color }) => (
          <div key={label} className="bg-panel border border-border rounded-xl p-4">
            <div className="text-dim text-xs font-mono uppercase">{label}</div>
            <div className={clsx("text-2xl font-mono font-bold mt-1 num", color)}>{value}</div>
            <div className="text-dim text-[10px] font-mono mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Indicators grid */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="text-dim text-xs font-mono uppercase tracking-widest mb-3">All Indicators</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "RSI", value: signal?.indicators?.rsi?.toFixed(1), warn: (v: number) => v > 70 || v < 30 },
            { label: "EMA9", value: `$${fmt(signal?.indicators?.ema9 ?? 0)}` },
            { label: "EMA21", value: `$${fmt(signal?.indicators?.ema21 ?? 0)}` },
            { label: "MACD", value: signal?.indicators?.macd?.toFixed(1) },
            { label: "Stoch K", value: signal?.indicators?.stochK?.toFixed(1) },
            { label: "VWAP", value: `$${fmt(signal?.indicators?.vwap ?? 0)}` },
            { label: "ATR", value: `$${fmt(signal?.indicators?.atr ?? 0)}` },
            { label: "W%R", value: signal?.indicators?.williamsR?.toFixed(1) },
            { label: "CCI", value: signal?.indicators?.cci?.toFixed(1) },
            { label: "CMF", value: signal?.indicators?.cmf?.toFixed(3) },
            { label: "BB Upper", value: `$${fmt(signal?.indicators?.bbUpper ?? 0)}` },
            { label: "BB Lower", value: `$${fmt(signal?.indicators?.bbLower ?? 0)}` },
          ].map(({ label, value, warn }) => {
            const isWarning = warn ? warn(parseFloat(value ?? "0")) : false;
            return (
              <div key={label} className="bg-surface rounded-lg p-2 text-center">
                <div className="text-dim text-[9px] font-mono uppercase">{label}</div>
                <div className={clsx("text-sm font-mono font-bold mt-0.5 num", isWarning ? "text-amber" : "text-text")}>{value ?? "—"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fear & Greed */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="text-dim text-xs font-mono uppercase mb-2">Fear & Greed</div>
          <div className={clsx("text-4xl font-mono font-black num",
            (market?.fearGreed ?? 50) > 60 ? "text-green" : (market?.fearGreed ?? 50) < 40 ? "text-red" : "text-amber"
          )}>
            {market?.fearGreed ?? "—"}
          </div>
          <div className="text-dim text-xs font-mono mt-1">{market?.fearGreedLabel ?? "—"}</div>
        </div>
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="text-dim text-xs font-mono uppercase mb-2">Halving Days</div>
          <div className="text-4xl font-mono font-black text-gold num">{market?.halvingDays ?? "—"}</div>
          <div className="text-dim text-xs font-mono mt-1">Target 2028 cycle</div>
        </div>
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="text-dim text-xs font-mono uppercase mb-2">Signal Badge</div>
          <div className={clsx("text-2xl font-mono font-black",
            (signal?.alphaScore ?? 0) >= 70 ? "text-green" : (signal?.alphaScore ?? 0) >= 60 ? "text-amber" : "text-red"
          )}>
            {signal?.direction ?? "WAIT"} {signal?.alphaScore ?? "—"}
          </div>
          <div className="text-dim text-xs font-mono mt-1">{signal?.confidenceTier?.replace(/_/g, " ") ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}
