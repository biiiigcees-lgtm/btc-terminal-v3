"use client";
// components/PnLTrackerTab.tsx — PnL Tracker · Weight Optimizer · Strategy Mode

import { PnLTrackerPanel } from "@/components/PnLTrackerPanel";
import { WeightOptimizerPanel } from "@/components/WeightOptimizerPanel";
import { StrategyModePanel } from "@/components/StrategyModePanel";
import { useTerminal } from "@/store/terminal";
import { STRATEGY_CONFIGS } from "@/lib/strategyConfig";
import clsx from "clsx";

function StrategyBadge() {
  const { strategyMode, edgeThreshold } = useTerminal();
  const cfg = STRATEGY_CONFIGS[strategyMode];
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          "text-[10px] font-mono font-bold px-2 py-1 rounded border",
          strategyMode === "AGGRESSIVE"
            ? "border-red/50 bg-red/10 text-red"
            : strategyMode === "BALANCED"
            ? "border-amber/50 bg-amber/10 text-amber"
            : "border-green/50 bg-green/10 text-green"
        )}
      >
        {cfg.emoji} {cfg.label}
      </span>
      <span className="text-dim text-[10px] font-mono">Edge: {edgeThreshold}/100</span>
    </div>
  );
}

export function PnLTrackerTab() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">PnL TRACKER & STRATEGY</h1>
          <p className="text-dim text-xs font-mono mt-0.5">
            LIVE SIMULATION · WEIGHT OPTIMIZER · KALSHI STRATEGY MODES
          </p>
        </div>
        <StrategyBadge />
      </div>

      {/* Strategy Mode + Edge Threshold — top priority since it controls everything */}
      <StrategyModePanel />

      {/* Live PnL simulation */}
      <PnLTrackerPanel />

      {/* Auto weight optimizer */}
      <WeightOptimizerPanel />
    </div>
  );
}
