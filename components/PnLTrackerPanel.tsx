"use client";
// components/PnLTrackerPanel.tsx — Real-time PnL simulation panel

import { useMemo } from "react";
import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

function MiniEquityCurve({ curve }: { curve: { timestamp: number; pnl: number }[] }) {
  if (curve.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center text-dim text-xs font-mono">
        Not enough data to render curve
      </div>
    );
  }

  const width = 400;
  const height = 96;
  const pad = 8;

  const minPnL = Math.min(...curve.map((p) => p.pnl));
  const maxPnL = Math.max(...curve.map((p) => p.pnl));
  const range = maxPnL - minPnL || 1;

  const points = curve.map((p, i) => {
    const x = pad + (i / (curve.length - 1)) * (width - pad * 2);
    const y = pad + ((maxPnL - p.pnl) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const lastPnL = curve[curve.length - 1].pnl;
  const isPositive = lastPnL >= 0;

  // Area fill path
  const lastX = pad + ((curve.length - 1) / (curve.length - 1)) * (width - pad * 2);
  const zeroY = pad + ((maxPnL - 0) / range) * (height - pad * 2);
  const clampedZeroY = Math.max(pad, Math.min(height - pad, zeroY));
  const areaPath = `M${pad},${clampedZeroY} L${points.join(" L")} L${lastX},${clampedZeroY} Z`;

  return (
    <div className="relative h-24 w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Zero line */}
        <line
          x1={pad}
          y1={clampedZeroY}
          x2={width - pad}
          y2={clampedZeroY}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
        {/* Area fill */}
        <path
          d={areaPath}
          fill={isPositive ? "rgba(0,255,136,0.08)" : "rgba(255,59,92,0.08)"}
        />
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={isPositive ? "#00ff88" : "#ff3b5c"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Last dot */}
        {(() => {
          const last = points[points.length - 1].split(",");
          return (
            <circle
              cx={last[0]}
              cy={last[1]}
              r="3"
              fill={isPositive ? "#00ff88" : "#ff3b5c"}
            />
          );
        })()}
      </svg>
    </div>
  );
}

export function PnLTrackerPanel() {
  const { getSimulatedPnLStats, accuracyLog } = useTerminal();
  const stats = useMemo(() => getSimulatedPnLStats(), [accuracyLog]);

  const resolvedCount = accuracyLog.filter((e) => e.resolved).length;
  const pendingCount = accuracyLog.filter((e) => !e.resolved && e.direction !== "WAIT").length;

  const pnlColor = stats.netPnL >= 0 ? "text-green" : "text-red";
  const sharpeColor = stats.sharpeRatio >= 1 ? "text-green" : stats.sharpeRatio >= 0 ? "text-amber" : "text-red";

  return (
    <div className="bg-panel border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-display font-bold text-text">LIVE PnL SIMULATION</h2>
          <p className="text-dim text-[10px] font-mono mt-0.5">
            Auto-tracks every signal · Resolves after 15 min · $1/trade simulated
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <div className="px-2 py-0.5 bg-amber/15 border border-amber/30 rounded text-amber text-[10px] font-mono animate-pulse">
              {pendingCount} pending
            </div>
          )}
          <div className={clsx(
            "px-2 py-0.5 rounded border text-[10px] font-mono font-bold",
            stats.netPnL >= 0
              ? "bg-green/10 border-green/30 text-green"
              : "bg-red/10 border-red/30 text-red"
          )}>
            {stats.netPnL >= 0 ? "+" : ""}${stats.netPnL.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Trades", value: stats.totalTrades, color: "text-text" },
          { label: "Win Rate", value: `${stats.winRate}%`, color: stats.winRate >= 55 ? "text-green" : stats.winRate >= 45 ? "text-amber" : "text-red" },
          { label: "Peak PnL", value: `+$${stats.peakPnL.toFixed(2)}`, color: "text-green" },
          { label: "Max DD", value: `-$${stats.maxDrawdown.toFixed(2)}`, color: "text-red" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface rounded-lg p-2.5 text-center">
            <div className="text-dim text-[9px] font-mono uppercase">{label}</div>
            <div className={clsx("text-base font-mono font-bold mt-1 num", color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sharpe + W/L */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface rounded-lg p-2.5 text-center">
          <div className="text-dim text-[9px] font-mono uppercase">Sharpe</div>
          <div className={clsx("text-sm font-mono font-bold mt-1 num", sharpeColor)}>
            {stats.sharpeRatio.toFixed(2)}
          </div>
        </div>
        <div className="bg-surface rounded-lg p-2.5 text-center">
          <div className="text-dim text-[9px] font-mono uppercase">Wins / Losses</div>
          <div className="text-sm font-mono font-bold mt-1">
            <span className="text-green">{stats.wins}W</span>
            <span className="text-dim mx-1">/</span>
            <span className="text-red">{stats.losses}L</span>
          </div>
        </div>
        <div className="bg-surface rounded-lg p-2.5 text-center">
          <div className="text-dim text-[9px] font-mono uppercase">Tracked</div>
          <div className="text-sm font-mono font-bold mt-1 text-accent">
            {resolvedCount}<span className="text-dim text-[9px] ml-1">sig</span>
          </div>
        </div>
      </div>

      {/* Equity curve */}
      <div className="bg-surface rounded-lg p-3">
        <div className="text-dim text-[9px] font-mono uppercase mb-2">Equity Curve (per $1 simulated)</div>
        {stats.equityCurve.length >= 2 ? (
          <MiniEquityCurve curve={stats.equityCurve} />
        ) : (
          <div className="h-16 flex items-center justify-center text-dim text-xs font-mono">
            {resolvedCount === 0
              ? "Signals accumulating… check back after a few cycles"
              : `${resolvedCount} signal${resolvedCount === 1 ? "" : "s"} tracked — need 2+ resolved to draw curve`}
          </div>
        )}
      </div>

      {/* Recent resolved signals */}
      {resolvedCount > 0 && (
        <div>
          <div className="text-dim text-[9px] font-mono uppercase mb-2">Recent Resolved Signals</div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {accuracyLog
              .filter((e) => e.resolved && e.direction !== "WAIT")
              .slice(0, 8)
              .map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between bg-surface rounded px-3 py-1.5 text-[10px] font-mono"
                >
                  <span className={e.direction === "ABOVE" ? "text-green" : "text-red"}>
                    {e.direction === "ABOVE" ? "▲" : "▽"} {e.direction}
                  </span>
                  <span className="text-dim">α{e.alpha}</span>
                  <span className="text-dim">{e.confidenceTier}</span>
                  <span className={e.correct ? "text-green" : "text-red"}>
                    {e.correct ? "✓ WIN" : "✗ LOSS"}
                  </span>
                  <span className={clsx("font-bold", e.correct ? "text-green" : "text-red")}>
                    {e.correct ? "+$1.00" : "-$1.00"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
