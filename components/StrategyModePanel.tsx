"use client";
// components/StrategyModePanel.tsx — Kalshi strategy modes + edge threshold slider

import { useTerminal } from "@/store/terminal";
import { STRATEGY_CONFIGS, edgeThresholdToParams, modeToThreshold } from "@/lib/strategyConfig";
import type { StrategyMode } from "@/lib/strategyConfig";
import clsx from "clsx";

const MODES: StrategyMode[] = ["AGGRESSIVE", "BALANCED", "CONSERVATIVE"];

export function StrategyModePanel() {
  const { strategyMode, setStrategyMode, edgeThreshold, setEdgeThreshold } = useTerminal();

  const params = edgeThresholdToParams(edgeThreshold);
  const cfg = STRATEGY_CONFIGS[strategyMode];

  function handleSliderChange(v: number) {
    setEdgeThreshold(v);
    // Snap mode indicator to nearest mode
    const newMode: StrategyMode =
      v <= 33 ? "AGGRESSIVE" : v <= 66 ? "BALANCED" : "CONSERVATIVE";
    if (newMode !== strategyMode) setStrategyMode(newMode);
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-display font-bold text-text">KALSHI STRATEGY MODE</h2>
        <p className="text-dim text-[10px] font-mono mt-0.5">
          Mode controls trade frequency, aggressiveness, and position sizing
        </p>
      </div>

      {/* Mode buttons */}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((mode) => {
          const c = STRATEGY_CONFIGS[mode];
          const isActive = strategyMode === mode;
          return (
            <button
              key={mode}
              onClick={() => {
                setStrategyMode(mode);
                setEdgeThreshold(modeToThreshold(mode));
              }}
              className={clsx(
                "py-3 px-2 rounded-xl border-2 font-mono text-xs font-bold transition-all text-center",
                isActive
                  ? mode === "AGGRESSIVE"
                    ? "border-red bg-red/15 text-red"
                    : mode === "BALANCED"
                    ? "border-amber bg-amber/15 text-amber"
                    : "border-green bg-green/15 text-green"
                  : "border-border text-dim hover:border-border/70 hover:text-text"
              )}
            >
              <div className="text-xl mb-1">{c.emoji}</div>
              <div>{c.label}</div>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div
        className={clsx(
          "rounded-lg px-3 py-2 border text-xs font-mono",
          strategyMode === "AGGRESSIVE"
            ? "bg-red/10 border-red/30 text-red/80"
            : strategyMode === "BALANCED"
            ? "bg-amber/10 border-amber/30 text-amber/80"
            : "bg-green/10 border-green/30 text-green/80"
        )}
      >
        {cfg.description}
      </div>

      {/* Edge Threshold Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-dim text-xs font-mono uppercase tracking-widest">
            Edge Threshold
          </span>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "text-xs font-mono font-bold px-2 py-0.5 rounded border",
                edgeThreshold <= 33
                  ? "text-red border-red/40 bg-red/10"
                  : edgeThreshold <= 66
                  ? "text-amber border-amber/40 bg-amber/10"
                  : "text-green border-green/40 bg-green/10"
              )}
            >
              {params.label}
            </span>
            <span className="text-accent font-mono font-bold text-sm">{edgeThreshold}</span>
          </div>
        </div>

        {/* Slider track */}
        <div className="relative">
          <div className="h-2 rounded-full bg-surface relative overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-200",
                edgeThreshold <= 33
                  ? "bg-gradient-to-r from-red to-amber"
                  : edgeThreshold <= 66
                  ? "bg-gradient-to-r from-amber to-green"
                  : "bg-gradient-to-r from-green to-green"
              )}
              style={{ width: `${edgeThreshold}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={edgeThreshold}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
          />
        </div>

        {/* Slider labels */}
        <div className="flex justify-between text-[9px] font-mono text-dim">
          <span className="text-red">0 = Max Aggressive</span>
          <span>Balanced</span>
          <span className="text-green">100 = Max Conservative</span>
        </div>
      </div>

      {/* Live parameter readout */}
      <div className="bg-surface rounded-lg p-3">
        <div className="text-dim text-[9px] font-mono uppercase mb-2">
          Current Thresholds (live)
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            { label: "EV Floor", value: `>${(params.evFloor * 100).toFixed(1)}%`, color: "text-accent" },
            { label: "Prob Floor", value: `>${params.probFloor}%`, color: "text-accent" },
            { label: "Agreement", value: `>${params.agreementFloor}%`, color: "text-accent" },
            { label: "Max Dissent", value: `<${params.dissentCeiling}%`, color: "text-accent" },
            { label: "Alpha Floor", value: `>${params.alphaFloor}`, color: "text-accent" },
            { label: "Kelly Mult", value: `×${params.kellyMultiplier.toFixed(2)}`, color: params.kellyMultiplier >= 0.75 ? "text-red" : params.kellyMultiplier >= 0.4 ? "text-amber" : "text-green" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-dim text-[10px] font-mono">{label}</span>
              <span className={clsx("text-[10px] font-mono font-bold num", color)}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk warning for aggressive mode */}
      {edgeThreshold < 25 && (
        <div className="bg-red/10 border border-red/30 rounded-lg px-3 py-2 text-red text-[10px] font-mono">
          ⚠️ AGGRESSIVE mode: Lower bars mean more trades but higher false-signal rate. Reduce position sizes.
        </div>
      )}

      {edgeThreshold > 80 && (
        <div className="bg-green/10 border border-green/30 rounded-lg px-3 py-2 text-green text-[10px] font-mono">
          🛡️ CONSERVATIVE mode: Very few signals will pass. High-precision, low-frequency trading.
        </div>
      )}
    </div>
  );
}
