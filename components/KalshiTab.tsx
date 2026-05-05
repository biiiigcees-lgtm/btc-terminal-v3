"use client";
// components/KalshiTab.tsx

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function KalshiTab() {
  const { signal, market } = useTerminal();

  const impliedProb = signal?.kalshiConf ?? 50;
  const edge = impliedProb - 50;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-display font-bold">KALSHI MARKETS</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-panel border border-border rounded-xl p-4 space-y-4">
          <div className="text-dim text-xs font-mono uppercase">BTC 15-Min Market — Current Edge</div>

          {/* Probability bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-2">
              <span className="text-green">ABOVE {impliedProb.toFixed(1)}%</span>
              <span className="text-red">BELOW {(100 - impliedProb).toFixed(1)}%</span>
            </div>
            <div className="h-6 bg-surface rounded-full overflow-hidden flex">
              <div
                className="h-full bg-green transition-all duration-500"
                style={{ width: `${impliedProb}%` }}
              />
              <div className="h-full flex-1 bg-red" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Edge vs 50/50", value: `${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`, color: edge >= 5 ? "text-green" : edge >= 2 ? "text-amber" : "text-red" },
              { label: "ATR Gate", value: signal?.atrGate ? "OPEN ✓" : "CLOSED ✗", color: signal?.atrGate ? "text-green" : "text-red" },
              { label: "Time Window", value: signal?.timeWindowGood ? "GOOD ✓" : "SKIP ✗", color: signal?.timeWindowGood ? "text-green" : "text-red" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface rounded-lg p-3 text-center">
                <div className="text-dim text-[9px] font-mono uppercase">{label}</div>
                <div className={clsx("text-sm font-mono font-bold mt-1", color)}>{value}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-dim text-[10px] font-mono uppercase mb-2">Time Window: {signal?.timeWindowLabel ?? "—"}</div>
            <div className="text-xs font-mono text-text">
              Best betting windows: <span className="text-green">NY Open (13–16 UTC)</span> · <span className="text-green">London Open (08–10 UTC)</span> · <span className="text-green">US Evening (20–22 UTC)</span>
            </div>
          </div>
        </div>

        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <div className="text-dim text-xs font-mono uppercase">Decision Summary</div>
          <div className={clsx("text-2xl font-display font-bold",
            signal?.confidenceTier === "HIGH_CONVICTION" || signal?.confidenceTier === "BET" ? "text-green" : "text-red"
          )}>
            {signal?.direction === "WAIT" ? "PASS" : signal?.direction ?? "WAIT"}
          </div>
          <div className="text-dim text-xs font-mono">{signal?.confidenceTier?.replace(/_/g, " ") ?? "—"}</div>
          <div className="space-y-2 mt-4 text-[10px] font-mono">
            {[
              { k: "Alpha", v: signal?.alphaScore ?? "—", pass: (signal?.alphaScore ?? 0) >= 70 },
              { k: "HTF", v: signal?.htfBias ?? "—", pass: signal?.htfAligned },
              { k: "ATR", v: signal?.atrGate ? "SAFE" : "VOLATILE", pass: signal?.atrGate },
              { k: "Window", v: signal?.timeWindowGood ? "GOOD" : "SKIP", pass: signal?.timeWindowGood },
            ].map(({ k, v, pass }) => (
              <div key={k} className="flex justify-between">
                <span className="text-dim">{k}</span>
                <span className={pass ? "text-green" : "text-red"}>{pass ? "✓" : "✗"} {v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
