"use client";
// components/AccuracyTab.tsx — Live signal accuracy tracker

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function AccuracyTab() {
  const { accuracyLog, clearAccuracyLog, getAccuracyStats } = useTerminal();
  const stats = getAccuracyStats();
  const resolved = accuracyLog.filter(e => e.resolved && e.correct !== null);
  const pending = accuracyLog.filter(e => !e.resolved);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">SIGNAL ACCURACY</h1>
          <p className="text-dim text-xs font-mono mt-0.5">Auto-tracked · Every signal fired is measured 15min later</p>
        </div>
        <button onClick={clearAccuracyLog} className="px-3 py-1.5 border border-red/30 text-red text-xs font-mono rounded hover:bg-red/10 transition-colors">
          Clear Log
        </button>
      </div>

      {/* Overall accuracy */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Accuracy", value: `${stats.accuracy}%`, color: stats.accuracy >= 55 ? "text-green" : stats.accuracy >= 50 ? "text-amber" : "text-red", sub: `${stats.correct}/${stats.total} correct` },
          { label: "Tracked", value: accuracyLog.length, color: "text-text", sub: "Total signals fired" },
          { label: "Pending", value: pending.length, color: "text-amber", sub: "Awaiting 15min" },
          { label: "Optimal Alpha", value: stats.optimalAlpha, color: "text-gold", sub: "Best performing bracket" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-panel border border-border rounded-xl p-4">
            <div className="text-dim text-xs font-mono uppercase">{label}</div>
            <div className={clsx("text-2xl font-mono font-bold mt-1 num", color)}>{value}</div>
            <div className="text-dim text-[10px] font-mono mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Honest assessment */}
      <div className={clsx("border rounded-xl px-4 py-3 font-mono text-sm",
        stats.total < 20 ? "bg-amber/10 border-amber/30 text-amber" :
        stats.accuracy >= 55 ? "bg-green/10 border-green/30 text-green" :
        stats.accuracy >= 50 ? "bg-amber/10 border-amber/30 text-amber" :
        "bg-red/10 border-red/30 text-red"
      )}>
        {stats.total < 20
          ? `⏳ Need ${20 - stats.total} more resolved signals for reliable accuracy data. Keep the terminal running.`
          : stats.accuracy >= 58
          ? `✅ Strong signal accuracy (${stats.accuracy}%). System is generating real edge. Optimal bracket: ${stats.optimalAlpha}.`
          : stats.accuracy >= 52
          ? `⚠️ Marginal accuracy (${stats.accuracy}%). Edge exists but is thin. Focus on ${stats.optimalAlpha} alpha range only.`
          : `🔴 Accuracy below 52% (${stats.accuracy}%). Signal may lack edge at current market conditions. Review indicator weights.`
        }
      </div>

      {/* By alpha bracket */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="text-dim text-xs font-mono uppercase tracking-widest mb-3">Accuracy by Alpha Bracket</div>
        <div className="space-y-3">
          {stats.byBracket.map(({ label, trades, correct, accuracy }) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-text font-bold">{label}</span>
                <span className={clsx(accuracy >= 58 ? "text-green" : accuracy >= 52 ? "text-amber" : "text-red")}>
                  {accuracy}% · {correct}/{trades} correct
                  {trades < 5 && <span className="text-dim ml-1">(low sample)</span>}
                </span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className={clsx("h-full rounded-full transition-all", accuracy >= 58 ? "bg-green" : accuracy >= 52 ? "bg-amber" : "bg-red")}
                  style={{ width: trades > 0 ? `${accuracy}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent signal log */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-dim text-xs font-mono uppercase">
          Recent Signals ({accuracyLog.length})
        </div>
        {accuracyLog.length === 0 ? (
          <div className="p-8 text-center text-dim font-mono text-sm">
            No signals tracked yet. Terminal auto-tracks every signal ≥ Alpha 60.
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/50 text-dim text-[10px]">
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Direction</th>
                <th className="px-3 py-2 text-left">Alpha</th>
                <th className="px-3 py-2 text-right">Entry</th>
                <th className="px-3 py-2 text-right">Exit</th>
                <th className="px-3 py-2 text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {accuracyLog.slice(0, 30).map((e) => (
                <tr key={e.id} className="border-b border-border/20 last:border-0">
                  <td className="px-3 py-2 text-dim">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td className={clsx("px-3 py-2 font-bold", e.direction === "ABOVE" ? "text-green" : "text-red")}>
                    {e.direction === "ABOVE" ? "▲" : "▽"} {e.direction}
                  </td>
                  <td className={clsx("px-3 py-2", e.alpha >= 80 ? "text-green" : e.alpha >= 70 ? "text-amber" : "text-dim")}>
                    {e.alpha}
                  </td>
                  <td className="px-3 py-2 text-right text-dim num">${e.entryPrice.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-dim num">
                    {e.resolvedPrice ? `$${e.resolvedPrice.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!e.resolved
                      ? <span className="text-amber">⏳ pending</span>
                      : e.correct === null
                      ? <span className="text-dim">—</span>
                      : e.correct
                      ? <span className="text-green font-bold">✓ CORRECT</span>
                      : <span className="text-red font-bold">✗ WRONG</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
