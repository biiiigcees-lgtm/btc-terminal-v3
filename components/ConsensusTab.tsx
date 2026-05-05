"use client";
// components/ConsensusTab.tsx

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function ConsensusTab() {
  const { signal } = useTerminal();

  const ind = signal?.indicators ?? {};
  const checks = [
    { name: "EMA 9 > 21", pass: (ind.ema9 ?? 0) > (ind.ema21 ?? 0), value: `${ind.ema9?.toFixed(0) ?? "—"} vs ${ind.ema21?.toFixed(0) ?? "—"}`, weight: 10 },
    { name: "EMA 21 > 50", pass: (ind.ema21 ?? 0) > (ind.ema50 ?? 0), value: `${ind.ema21?.toFixed(0) ?? "—"} vs ${ind.ema50?.toFixed(0) ?? "—"}`, weight: 10 },
    { name: "RSI 45–75", pass: (ind.rsi ?? 50) > 45 && (ind.rsi ?? 50) < 75, value: ind.rsi?.toFixed(1) ?? "—", weight: 8 },
    { name: "MACD > Signal", pass: (ind.macd ?? 0) > (ind.macdSignal ?? 0), value: `${ind.macd?.toFixed(2) ?? "—"}`, weight: 10 },
    { name: "Stoch Bull", pass: (ind.stochK ?? 50) > 50 && (ind.stochK ?? 0) > (ind.stochD ?? 0), value: `K:${ind.stochK?.toFixed(0) ?? "—"}`, weight: 6 },
    { name: "Williams %R < -50", pass: (ind.williamsR ?? -50) < -50, value: ind.williamsR?.toFixed(1) ?? "—", weight: 8 },
    { name: "CCI Positive", pass: (ind.cci ?? 0) > 0, value: ind.cci?.toFixed(1) ?? "—", weight: 8 },
    { name: "CMF > 0", pass: (ind.cmf ?? 0) > 0, value: ind.cmf?.toFixed(3) ?? "—", weight: 8 },
    { name: "HTF Aligned", pass: signal?.htfAligned ?? false, value: signal?.htfBias ?? "—", weight: 20 },
    { name: "ATR Gate Open", pass: signal?.atrGate ?? false, value: signal?.atrGate ? "SAFE" : "VOLATILE", weight: 15 },
    { name: "Time Window Good", pass: signal?.timeWindowGood ?? false, value: signal?.timeWindowLabel ?? "—", weight: 10 },
  ];

  const bullPasses = checks.filter(c => c.pass).length;
  const total = checks.length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">CONSENSUS</h1>
        <div className="text-dim text-xs font-mono">
          {bullPasses}/{total} PASSING ·{" "}
          <span className={bullPasses >= 8 ? "text-green" : bullPasses >= 6 ? "text-amber" : "text-red"}>
            {Math.round((bullPasses / total) * 100)}%
          </span>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        {checks.map((c, i) => (
          <div key={c.name} className={clsx(
            "flex items-center justify-between px-4 py-3 border-b border-border/30 last:border-0",
            i % 2 === 0 ? "bg-surface/20" : ""
          )}>
            <div className="flex items-center gap-3">
              <div className={clsx("w-2 h-2 rounded-full", c.pass ? "bg-green" : "bg-red")} />
              <span className="text-xs font-mono text-text">{c.name}</span>
              <span className="text-[10px] font-mono text-dim">({c.weight}pts)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-dim num">{c.value}</span>
              <span className={clsx("text-xs font-mono font-bold w-8 text-right", c.pass ? "text-green" : "text-red")}>
                {c.pass ? "✓" : "✗"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
