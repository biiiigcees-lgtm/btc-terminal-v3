"use client";
// components/LogsTab.tsx

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function LogsTab() {
  const { logs, clearLogs, session } = useTerminal();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">TRADE LOGS</h1>
          <p className="text-dim text-xs font-mono mt-0.5">{logs.length} TOTAL · {session.wins}W / {session.losses}L · {session.winRate}% WIN RATE</p>
        </div>
        <button onClick={clearLogs} className="px-3 py-1.5 border border-red/30 text-red text-xs font-mono rounded hover:bg-red/10 transition-colors">
          Clear All
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl p-12 text-center">
          <div className="text-dim font-mono text-sm">No trades logged yet. Use the Planner tab to log bets.</div>
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-dim uppercase text-[10px]">
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Direction</th>
                <th className="px-4 py-3 text-left">Alpha</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Bet</th>
                <th className="px-4 py-3 text-left">Result</th>
                <th className="px-4 py-3 text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} className={clsx(
                  "border-b border-border/30 last:border-0",
                  i % 2 === 0 ? "bg-surface/30" : ""
                )}>
                  <td className="px-4 py-2.5 text-dim">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx("font-bold", log.direction === "ABOVE" ? "text-green" : "text-red")}>
                      {log.direction === "ABOVE" ? "▲" : "▽"} {log.direction}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={clsx(log.alphaScore >= 70 ? "text-green" : log.alphaScore >= 60 ? "text-amber" : "text-red")}>
                      {log.alphaScore}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-dim">{log.confidenceTier?.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-text num">${log.betSize.toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold",
                      log.result === "WIN" ? "bg-green/15 text-green"
                        : log.result === "LOSS" ? "bg-red/15 text-red"
                        : "bg-amber/15 text-amber"
                    )}>
                      {log.result}
                    </span>
                  </td>
                  <td className={clsx("px-4 py-2.5 text-right font-bold num",
                    log.pnl > 0 ? "text-green" : log.pnl < 0 ? "text-red" : "text-dim"
                  )}>
                    {log.pnl !== 0 ? `${log.pnl > 0 ? "+" : ""}$${log.pnl.toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
