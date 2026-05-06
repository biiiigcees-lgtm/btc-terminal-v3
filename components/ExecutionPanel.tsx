"use client";
// components/ExecutionPanel.tsx — Auto execution engine control panel

import { useTerminal } from "@/store/terminal";
import { RISK_LIMITS } from "@/lib/riskEngine";
import type { ExecutionRecord } from "@/types";
import clsx from "clsx";

function StatusDot({ active }: { active: boolean }) {
  return (
    <div
      className={clsx(
        "w-2 h-2 rounded-full shrink-0",
        active ? "bg-green animate-pulse" : "bg-dim"
      )}
    />
  );
}

function RecordRow({ record }: { record: ExecutionRecord }) {
  const passed = record.riskGate === "PASSED";
  const time = new Date(record.timestamp).toLocaleTimeString();
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 text-[10px] font-mono gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={clsx("shrink-0 font-bold", passed ? "text-green" : "text-red")}>
          {passed ? "✓" : "✗"}
        </span>
        <span className="text-dim shrink-0">{time}</span>
        <span className={clsx("font-bold shrink-0", record.signal.direction === "ABOVE" ? "text-green" : "text-red")}>
          {record.signal.direction}
        </span>
        <span className="text-text shrink-0">α{record.signal.alphaScore}</span>
        <span className="text-dim shrink-0">EV {record.signal.ev.toFixed(3)}</span>
      </div>
      <div className="shrink-0 text-right">
        {passed && record.fill ? (
          <span className="text-accent">
            ${record.fill.size.toFixed(2)} {record.fill.live ? "LIVE" : "SIM"}
          </span>
        ) : (
          <span className="text-dim truncate max-w-[140px] block">{record.blockReason}</span>
        )}
      </div>
    </div>
  );
}

export function ExecutionPanel() {
  const {
    autoMode, setAutoMode,
    liveTradingEnabled, setLiveTradingEnabled,
    executionLog, clearExecutionLog,
    signal, session,
  } = useTerminal();

  const recentLog = executionLog.slice(0, 25);
  const passedCount = executionLog.filter((r) => r.riskGate === "PASSED").length;
  const blockedCount = executionLog.filter((r) => r.riskGate === "BLOCKED").length;
  const fillRate = executionLog.length > 0 ? Math.round((passedCount / executionLog.length) * 100) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">EXECUTION ENGINE</h1>
          <p className="text-dim text-xs font-mono mt-0.5">SIGNAL → RISK GATE → FILL → FEEDBACK</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot active={autoMode} />
          <span className={clsx("text-xs font-mono", autoMode ? "text-green" : "text-dim")}>
            {autoMode ? "ACTIVE" : "IDLE"}
          </span>
        </div>
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <div className="text-dim text-xs font-mono uppercase tracking-widest">Auto Mode</div>
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={clsx(
              "w-full py-3 rounded-lg border-2 font-display font-bold text-base transition-all",
              autoMode
                ? "border-green bg-green/15 text-green glow-green"
                : "border-border text-dim hover:border-accent/50 hover:text-text"
            )}
          >
            {autoMode ? "⚡ AUTO ON" : "○ AUTO OFF"}
          </button>
          <p className="text-dim text-[9px] font-mono">
            Every new signal passes risk gate then routes to fill
          </p>
        </div>

        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <div className="text-dim text-xs font-mono uppercase tracking-widest">Execution Mode</div>
          <button
            onClick={() => setLiveTradingEnabled(!liveTradingEnabled)}
            className={clsx(
              "w-full py-3 rounded-lg border-2 font-display font-bold text-base transition-all",
              liveTradingEnabled
                ? "border-red bg-red/15 text-red glow-red"
                : "border-border text-dim hover:border-amber/50 hover:text-amber"
            )}
          >
            {liveTradingEnabled ? "🔴 LIVE ORDERS" : "○ SIMULATED"}
          </button>
          <p className={clsx("text-[9px] font-mono", liveTradingEnabled ? "text-amber" : "text-dim")}>
            {liveTradingEnabled
              ? "⚠️ Real Kalshi orders will be placed (KALSHI_API_KEY required)"
              : "Safe: fills are simulated, no real capital at risk"}
          </p>
        </div>
      </div>

      {/* Current signal snapshot */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="text-dim text-xs font-mono uppercase tracking-widest mb-3">Current Signal State</div>
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Direction",
              value: signal?.direction ?? "—",
              color: signal?.direction === "ABOVE" ? "text-green" : signal?.direction === "BELOW" ? "text-red" : "text-dim",
            },
            {
              label: "Alpha",
              value: signal ? `${signal.alphaScore}` : "—",
              color: (signal?.alphaScore ?? 0) >= 70 ? "text-green" : (signal?.alphaScore ?? 0) >= 60 ? "text-amber" : "text-red",
            },
            {
              label: "Tier",
              value: signal?.confidenceTier?.replace(/_/g, " ") ?? "—",
              color: signal?.confidenceTier === "HIGH_CONVICTION" || signal?.confidenceTier === "BET" ? "text-green" : "text-red",
            },
            {
              label: "ATR Gate",
              value: signal?.atrGate ? "PASS" : signal ? "BLOCK" : "—",
              color: signal?.atrGate ? "text-green" : signal ? "text-red" : "text-dim",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface rounded-lg p-2 text-center">
              <div className="text-dim text-[9px] font-mono uppercase">{label}</div>
              <div className={clsx("text-sm font-mono font-bold mt-0.5 num", color)}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk engine limits */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="text-dim text-xs font-mono uppercase tracking-widest mb-3">
          Risk Engine — Hard Limits
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[10px] font-mono">
          {[
            ["Min alpha score", `≥ ${RISK_LIMITS.minAlphaScore}`],
            ["Min confidence", `≥ ${RISK_LIMITS.minConfidence}%`],
            ["Max exposure per trade", `${RISK_LIMITS.maxExposurePct * 100}% of bankroll`],
            ["Bankroll", `$${session.bankroll.toFixed(2)}`],
            ["Allowed tiers", "BET · HIGH_CONVICTION"],
            ["ATR gate", "Required — blocks high vol"],
            ["Time window", "Required — blocks off-hours"],
            ["Direction", "WAIT never executes"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border/20 py-0.5">
              <span className="text-dim">{label}</span>
              <span className="text-text">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Execution stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Approved", value: passedCount, color: "text-green" },
          { label: "Blocked", value: blockedCount, color: "text-red" },
          { label: "Fill Rate", value: `${fillRate}%`, color: fillRate > 30 ? "text-amber" : "text-dim" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-panel border border-border rounded-xl p-4 text-center">
            <div className="text-dim text-xs font-mono uppercase mb-1">{label}</div>
            <div className={clsx("text-3xl font-mono font-black num", color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Execution log */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-dim text-xs font-mono uppercase tracking-widest">Execution Log</div>
          {executionLog.length > 0 && (
            <button
              onClick={clearExecutionLog}
              className="text-dim text-[9px] font-mono hover:text-red transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {recentLog.length === 0 ? (
          <div className="text-dim text-xs font-mono text-center py-8">
            No executions yet — enable Auto Mode to start the pipeline
          </div>
        ) : (
          <div>
            {recentLog.map((record) => (
              <RecordRow key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
