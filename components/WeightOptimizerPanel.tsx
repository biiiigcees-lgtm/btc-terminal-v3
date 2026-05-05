"use client";
// components/WeightOptimizerPanel.tsx — Auto Weight Optimizer (Learning System v2)

import { useMemo } from "react";
import { useTerminal } from "@/store/terminal";
import { BASE_WEIGHTS } from "@/lib/weightOptimizer";
import clsx from "clsx";

const AGENT_LABELS: Record<string, { label: string; icon: string }> = {
  momentum:      { label: "Momentum",     icon: "⚡" },
  volatility:    { label: "Volatility",   icon: "〰" },
  meanReversion: { label: "Mean Rev",     icon: "↩" },
  orderFlow:     { label: "Order Flow",   icon: "⟳" },
  kalshi:        { label: "Kalshi",       icon: "⌁" },
};

function WeightBar({
  key: _key,
  label,
  icon,
  current,
  optimized,
}: {
  key: string;
  label: string;
  icon: string;
  current: number;
  optimized: number;
}) {
  const delta = optimized - current;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const barW = (v: number) => `${Math.min(100, v * 100 * 2.5)}%`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-dim">
          {icon} {label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-dim">{pct(current)}</span>
          <span className="text-accent font-bold">{pct(optimized)}</span>
          <span
            className={clsx(
              "w-12 text-right font-bold",
              delta > 0.005 ? "text-green" : delta < -0.005 ? "text-red" : "text-dim"
            )}
          >
            {delta > 0.005 ? "+" : ""}{(delta * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="relative h-1.5 bg-surface rounded-full overflow-hidden">
        {/* Current weight (dimmer) */}
        <div
          className="absolute inset-y-0 left-0 bg-border rounded-full"
          style={{ width: barW(current) }}
        />
        {/* Optimized weight (brighter) */}
        <div
          className={clsx(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            delta > 0.005 ? "bg-green" : delta < -0.005 ? "bg-red" : "bg-accent"
          )}
          style={{ width: barW(optimized) }}
        />
      </div>
    </div>
  );
}

export function WeightOptimizerPanel() {
  const { accuracyLog, getWeightOptimization, customWeights, setCustomWeights } = useTerminal();

  const result = useMemo(() => getWeightOptimization(), [accuracyLog]);

  const { optimizedWeights, currentWeights, improvement, confidence, basedOnTrades, insights, performanceByBracket } =
    result;

  const isApplied =
    customWeights !== null &&
    customWeights.lastUpdated === optimizedWeights.lastUpdated;

  const bracketKeys = Object.keys(performanceByBracket).sort((a, b) => {
    const aMin = parseInt(a.split("-")[0]);
    const bMin = parseInt(b.split("-")[0]);
    return aMin - bMin;
  });

  return (
    <div className="bg-panel border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-display font-bold text-text">AUTO WEIGHT OPTIMIZER</h2>
          <p className="text-dim text-[10px] font-mono mt-0.5">
            Learning System v2 · Adapts agent weights from signal accuracy
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confidence > 0 && (
            <div className="text-[10px] font-mono text-dim">
              {basedOnTrades} trades · {confidence}% conf
            </div>
          )}
          <div
            className={clsx(
              "px-2 py-0.5 rounded border text-[10px] font-mono font-bold",
              improvement > 5
                ? "bg-green/10 border-green/30 text-green"
                : "bg-border/50 border-border text-dim"
            )}
          >
            {improvement > 0 ? `Δ${improvement.toFixed(1)}%` : "BASE"}
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-surface rounded-lg p-3 space-y-1">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px] font-mono text-dim">
              <span className="text-accent mt-0.5">›</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}

      {/* Weight comparison */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[9px] font-mono text-dim uppercase">
          <span>Agent</span>
          <div className="flex gap-3 pr-0.5">
            <span>Current</span>
            <span className="text-accent">Optimized</span>
            <span className="w-12 text-right">Delta</span>
          </div>
        </div>
        {Object.entries(AGENT_LABELS).map(([key, { label, icon }]) => (
          <WeightBar
            key={key}
            label={label}
            icon={icon}
            current={(currentWeights as Record<string, number>)[key] ?? 0.2}
            optimized={(optimizedWeights as Record<string, number>)[key] ?? 0.2}
          />
        ))}
      </div>

      {/* Performance by alpha bracket */}
      {bracketKeys.length > 0 && (
        <div>
          <div className="text-dim text-[9px] font-mono uppercase mb-2">Accuracy by Alpha Bracket</div>
          <div className="grid grid-cols-3 gap-1.5">
            {bracketKeys.map((key) => {
              const data = performanceByBracket[key];
              return (
                <div key={key} className="bg-surface rounded p-2 text-center">
                  <div className="text-dim text-[8px] font-mono">α{key}</div>
                  <div
                    className={clsx(
                      "text-sm font-mono font-bold mt-0.5",
                      data.accuracy >= 55 ? "text-green" : data.accuracy >= 45 ? "text-amber" : "text-red"
                    )}
                  >
                    {data.accuracy}%
                  </div>
                  <div className="text-dim text-[8px] font-mono">{data.trades}t</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Apply / Reset buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setCustomWeights(optimizedWeights)}
          disabled={confidence < 20}
          className={clsx(
            "flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition-all",
            confidence >= 20
              ? "border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 cursor-pointer"
              : "border-border/30 text-dim/30 cursor-not-allowed"
          )}
        >
          {isApplied ? "✓ WEIGHTS APPLIED" : "APPLY OPTIMIZED WEIGHTS"}
        </button>
        {customWeights !== null && (
          <button
            onClick={() => setCustomWeights(null)}
            className="px-3 py-2 rounded-lg border border-red/40 bg-red/10 text-red text-xs font-mono hover:bg-red/20 transition-all"
          >
            RESET
          </button>
        )}
      </div>

      {customWeights !== null && (
        <div className="text-[10px] font-mono text-accent text-center">
          ✓ Custom weights active — system using optimized configuration
        </div>
      )}

      {confidence < 20 && (
        <div className="text-[10px] font-mono text-dim text-center">
          Collect {Math.max(0, 5 - basedOnTrades)} more resolved signals to unlock optimizer
        </div>
      )}
    </div>
  );
}
