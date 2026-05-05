"use client";
// components/Sidebar.tsx — Upgraded with all 9 new features

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

const TABS = [
  { id: "overview",  label: "Overview",  icon: "◫" },
  { id: "kalshi",    label: "Kalshi",    icon: "⌁" },
  { id: "consensus", label: "Consensus", icon: "◎" },
  { id: "planner",   label: "Planner",   icon: "◈" },
  { id: "backtest",  label: "Backtest",  icon: "⟲", badge: "NEW" },
  { id: "accuracy",  label: "Accuracy",  icon: "◉", badge: "NEW" },
  { id: "logs",      label: "Logs",      icon: "≣" },
  { id: "alerts",    label: "Alerts",    icon: "⏺" },
] as const;

export function Sidebar() {
  const { activeTab, setTab, session, signal, dataStale, getAccuracyStats, backtestResult } = useTerminal();
  const accuracyStats = getAccuracyStats();

  const tierColor =
    signal?.confidenceTier === "HIGH_CONVICTION" ? "text-green" :
    signal?.confidenceTier === "BET" ? "text-green" :
    signal?.confidenceTier === "MARGINAL" ? "text-amber" : "text-red";

  const dd = session.peakBankroll > 0
    ? Math.round(((session.peakBankroll - session.bankroll) / session.peakBankroll) * 100)
    : 0;

  return (
    <aside className="w-52 bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-accent text-xl font-display font-bold">₿</span>
          <div>
            <div className="text-text font-display font-bold text-sm leading-none">BTC TERMINAL</div>
            <div className="text-dim text-[10px] font-mono mt-0.5">v3.1 · 9 UPGRADES</div>
          </div>
        </div>
      </div>

      {/* Data stale warning */}
      {dataStale && (
        <div className="mx-2 mt-2 bg-red/10 border border-red/30 rounded px-2 py-1.5 text-red text-[10px] font-mono animate-pulse">
          ⚠️ DATA STALE — Check connection
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <div className="text-dim text-[10px] font-mono uppercase tracking-widest px-2 py-1">Navigation</div>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={clsx(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-sm transition-all duration-150 text-left",
              activeTab === tab.id ? "tab-active font-medium" : "text-dim hover:text-text hover:bg-panel"
            )}
          >
            <span className="text-base w-4">{tab.icon}</span>
            <span className="font-body flex-1">{tab.label}</span>
            {"badge" in tab && tab.badge && (
              <span className="text-[8px] font-mono bg-accent/20 text-accent px-1 py-0.5 rounded">{tab.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Quick Stats */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="text-dim text-[10px] font-mono uppercase tracking-widest mb-2">Live Stats</div>

        <div className="bg-panel rounded p-2">
          <div className="text-dim text-[9px] font-mono uppercase">Signal</div>
          <div className={clsx("text-sm font-mono font-bold mt-0.5 num", tierColor)}>
            {signal?.direction ?? "—"} {signal?.alphaScore ?? "—"}
          </div>
        </div>

        <div className="bg-panel rounded p-2">
          <div className="text-dim text-[9px] font-mono uppercase">P&L · Drawdown</div>
          <div className={clsx("text-sm font-mono font-bold mt-0.5 num", session.netPnl >= 0 ? "text-green" : "text-red")}>
            {session.netPnl >= 0 ? "+" : ""}${session.netPnl.toFixed(2)}
          </div>
          {dd > 0 && (
            <div className={clsx("text-[9px] font-mono", dd >= 25 ? "text-red" : dd >= 15 ? "text-amber" : "text-dim")}>
              ↓{dd}% from peak
            </div>
          )}
        </div>

        <div className="bg-panel rounded p-2">
          <div className="text-dim text-[9px] font-mono uppercase">Win Rate</div>
          <div className={clsx("text-sm font-mono font-bold mt-0.5 num",
            session.winRate >= 55 ? "text-green" : session.winRate >= 45 ? "text-amber" : "text-red"
          )}>
            {session.winRate}%
            <span className="text-dim text-[9px] ml-1">({session.wins}W/{session.losses}L)</span>
          </div>
        </div>

        <div className="bg-panel rounded p-2">
          <div className="text-dim text-[9px] font-mono uppercase">Signal Accuracy</div>
          <div className={clsx("text-sm font-mono font-bold mt-0.5 num",
            accuracyStats.total < 10 ? "text-dim" :
            accuracyStats.accuracy >= 55 ? "text-green" :
            accuracyStats.accuracy >= 50 ? "text-amber" : "text-red"
          )}>
            {accuracyStats.total < 10 ? `${accuracyStats.total} signals` : `${accuracyStats.accuracy}%`}
          </div>
          {backtestResult && (
            <div className="text-[9px] font-mono text-dim">BT: {backtestResult.winRate}% · {backtestResult.totalTrades}t</div>
          )}
        </div>

        <div className="bg-panel rounded p-2">
          <div className="text-dim text-[9px] font-mono uppercase">Bankroll</div>
          <div className="text-sm font-mono font-bold mt-0.5 text-accent num">
            ${session.bankroll.toFixed(2)}
          </div>
        </div>

        {session.isLocked && (
          <div className="bg-red/10 border border-red/30 rounded p-2 animate-pulse">
            <div className="text-red text-[10px] font-mono font-bold">🔒 LOCKED</div>
            <div className="text-red/70 text-[9px] font-mono">3 losses — cooling off</div>
          </div>
        )}
      </div>
    </aside>
  );
}
