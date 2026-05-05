"use client";
// components/PlannerTab.tsx — God-Tier Trade Planner v3.1

import { useState } from "react";
import { useTerminal } from "@/store/terminal";
import { calcKellyBet } from "@/lib/scoring";
import { DrawdownWarning } from "@/components/DrawdownWarning";
import { GroqPanel } from "@/components/GroqPanel";
import { OrderBook } from "@/components/OrderBook";
import clsx from "clsx";

function fmt(n: number, d = 0) {
  return n?.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) ?? "—";
}

function ConfidenceTierBadge({ tier, label }: { tier: string; label: string }) {
  const styles = {
    HIGH_CONVICTION: "bg-green/15 border-green/50 text-green glow-green",
    BET: "bg-green/10 border-green/40 text-green",
    MARGINAL: "bg-amber/10 border-amber/40 text-amber",
    DO_NOT_BET: "bg-red/10 border-red/40 text-red",
  }[tier] ?? "bg-panel border-border text-dim";
  return (
    <div className={clsx("border rounded-lg px-4 py-3 text-center font-mono font-bold text-sm", styles)}>
      {label}
    </div>
  );
}

function StreakWarning({ wins, losses }: { wins: number; losses: number }) {
  if (wins >= 3) return (
    <div className="bg-amber/10 border border-amber/30 rounded-lg px-3 py-2 text-amber text-xs font-mono">
      ⚡ WIN STREAK ({wins}) — Reduce bet size. Overconfidence kills accounts.
    </div>
  );
  if (losses >= 2) return (
    <div className="bg-red/10 border border-red/30 rounded-lg px-3 py-2 text-red text-xs font-mono">
      ⚠️ {losses} CONSECUTIVE LOSSES — {3 - losses} more triggers 30-min cooldown.
    </div>
  );
  return null;
}

function SessionPnLBar() {
  const { session, resetSession } = useTerminal();
  const total = session.wins + session.losses;
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-dim text-xs font-mono uppercase tracking-widest">Session Performance</span>
        <button onClick={resetSession} className="text-dim text-[10px] font-mono hover:text-red transition-colors">Reset</button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Bets", value: session.betsToday, color: "text-text" },
          { label: "Wins", value: session.wins, color: "text-green" },
          { label: "Losses", value: session.losses, color: "text-red" },
          { label: "Win Rate", value: `${session.winRate}%`, color: session.winRate >= 55 ? "text-green" : session.winRate >= 45 ? "text-amber" : "text-red" },
          { label: "Net P&L", value: `${session.netPnl >= 0 ? "+" : ""}$${session.netPnl.toFixed(2)}`, color: session.netPnl >= 0 ? "text-green" : "text-red" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface rounded-lg p-2.5 text-center">
            <div className="text-dim text-[9px] font-mono uppercase">{label}</div>
            <div className={clsx("text-base font-mono font-bold mt-1 num", color)}>{value}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="mt-3 h-1.5 bg-surface rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green to-accent transition-all duration-500" style={{ width: `${session.winRate}%` }} />
        </div>
      )}
    </div>
  );
}

function HourlyHeatmap() {
  const { session } = useTerminal();
  const currentHour = new Date().getUTCHours();
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="text-dim text-xs font-mono uppercase tracking-widest mb-3">Win Rate Heatmap by Hour (UTC)</div>
      <div className="flex gap-0.5">
        {Array.from({ length: 24 }, (_, h) => {
          const stats = session.hourlyStats[h];
          const total = stats ? stats.wins + stats.losses : 0;
          const wr = total > 0 ? stats!.wins / total : 0;
          return (
            <div key={h} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-sm"
                style={{
                  height: "24px",
                  background: total === 0 ? "rgba(30,45,64,0.5)"
                    : `rgba(${wr > 0.5 ? `0,255,136,${wr * 0.8}` : `255,59,92,${(1 - wr) * 0.8}`})`,
                  border: h === currentHour ? "1px solid #00e5ff" : "none",
                }}
                title={`${h}:00 UTC — ${total === 0 ? "No data" : `${stats!.wins}W/${stats!.losses}L`}`}
              />
              {h % 6 === 0 && <div className="text-[8px] text-dim font-mono">{h}h</div>}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] font-mono text-dim">
        <span>🔴 Low win rate</span>
        <span>Current: {currentHour}:00 UTC</span>
        <span>🟢 High win rate</span>
      </div>
    </div>
  );
}

export function PlannerTab() {
  const { signal, session, aiAuto, setAiAuto, userDirection, setUserDirection, logTrade, resolveTrade, logs, setBankroll } = useTerminal();
  const [bankrollInput, setBankrollInput] = useState(String(session.bankroll));

  const effectiveDirection = aiAuto
    ? (signal?.direction ?? "WAIT")
    : (userDirection === "UP" ? "ABOVE" : userDirection === "DOWN" ? "BELOW" : "WAIT");

  const conf = signal?.confidence ?? 50;
  const alpha = signal?.alphaScore ?? 0;
  const kelly = calcKellyBet(session.bankroll, conf);
  const pendingLogs = logs.filter(l => l.result === "PENDING");
  const canBet = (signal?.confidenceTier === "BET" || signal?.confidenceTier === "HIGH_CONVICTION") && !session.isLocked;

  const tierLabel = {
    HIGH_CONVICTION: "💎 HIGH CONVICTION — BET",
    BET: "🟢 CONFIRMED SIGNAL — BET",
    MARGINAL: "🟡 MARGINAL — SKIP",
    DO_NOT_BET: "🔴 DO NOT BET — WAIT",
  }[signal?.confidenceTier ?? "DO_NOT_BET"] ?? "🔴 DO NOT BET";

  function handleBet(dir: "ABOVE" | "BELOW") {
    if (!signal || session.isLocked) return;
    logTrade({ timestamp: Date.now(), direction: dir, confidence: conf, alphaScore: alpha, confidenceTier: signal.confidenceTier, result: "PENDING", pnl: 0, betSize: kelly.betSize });
  }

  function handleResolve(id: string, result: "WIN" | "LOSS") {
    const log = logs.find(l => l.id === id);
    if (!log) return;
    resolveTrade(id, result, result === "WIN" ? log.betSize : -log.betSize);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">TRADE PLANNER</h1>
          <p className="text-dim text-xs font-mono mt-0.5">SIGNAL · SIZING · LOGGING · AI REASONING · ORDER BOOK</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-dim">
          <span className={signal?.timeWindowGood ? "text-green" : "text-red"}>{signal?.timeWindowLabel ?? "—"}</span>
          <span className={signal?.atrGate ? "text-green" : "text-red"}>{signal?.atrGate ? "ATR ✓" : "ATR ✗"}</span>
          <span className={signal?.htfAligned ? "text-green" : "text-amber"}>{signal?.htfBias ?? "HTF —"}</span>
        </div>
      </div>

      {/* Drawdown warning — NEW */}
      <DrawdownWarning />

      <SessionPnLBar />
      <StreakWarning wins={session.consecutiveWins} losses={session.consecutiveLosses} />

      {/* Main signal grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Direction */}
        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-dim text-xs font-mono uppercase">Direction</span>
            <button
              onClick={() => setAiAuto(!aiAuto)}
              className={clsx("text-[10px] font-mono px-2 py-0.5 rounded border transition-all",
                aiAuto ? "border-accent text-accent bg-accent/10" : "border-border text-dim"
              )}
            >{aiAuto ? "AI AUTO" : "MANUAL"}</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setAiAuto(false); setUserDirection("UP"); }}
              className={clsx("py-4 rounded-lg border-2 font-display font-bold text-lg transition-all",
                effectiveDirection === "ABOVE" ? "border-green bg-green/15 text-green glow-green" : "border-border text-dim hover:border-green/50"
              )}>▲ UP</button>
            <button onClick={() => { setAiAuto(false); setUserDirection("DOWN"); }}
              className={clsx("py-4 rounded-lg border-2 font-display font-bold text-lg transition-all",
                effectiveDirection === "BELOW" ? "border-red bg-red/15 text-red glow-red" : "border-border text-dim hover:border-red/50"
              )}>▽ DOWN</button>
          </div>
          <div className="text-center text-xs font-mono text-dim">
            {aiAuto ? "AI AUTO" : "MANUAL"} —{" "}
            <span className={effectiveDirection === "ABOVE" ? "text-green" : effectiveDirection === "BELOW" ? "text-red" : "text-amber"}>
              {effectiveDirection}
            </span>
          </div>
        </div>

        {/* Alpha score */}
        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <span className="text-dim text-xs font-mono uppercase">Alpha Score</span>
          <div className="flex items-end gap-3">
            <div className={clsx("text-6xl font-mono font-black num",
              alpha >= 70 ? "text-green" : alpha >= 60 ? "text-amber" : "text-red"
            )}>{alpha}</div>
            <div className="mb-2 text-dim text-xs font-mono">/100</div>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all duration-500",
              alpha >= 70 ? "bg-green" : alpha >= 60 ? "bg-amber" : "bg-red"
            )} style={{ width: `${alpha}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
            <div className="text-red">0–59 NO BET</div>
            <div className="text-amber">60–69 MARGINAL</div>
            <div className="text-green">70+ BET</div>
          </div>
        </div>

        {/* Regime + HTF */}
        <div className="bg-panel border border-border rounded-xl p-4 space-y-3">
          <span className="text-dim text-xs font-mono uppercase">Regime</span>
          <div className="text-2xl font-display font-bold text-text">{signal?.regime ?? "—"}</div>
          <div className="text-dim text-xs font-mono">HOLD {signal?.regimeHold ?? "—"}%</div>
          <div className="border-t border-border pt-2">
            <div className="text-dim text-[10px] font-mono uppercase mb-1">HTF Bias</div>
            <div className={clsx("text-sm font-mono font-bold",
              signal?.htfBias === "BULL" ? "text-green" : signal?.htfBias === "BEAR" ? "text-red" : "text-amber"
            )}>
              {signal?.htfBias ?? "NEUTRAL"}{" "}
              <span className="text-dim text-[10px]">{signal?.htfAligned ? "✓ ALIGNED" : "✗ CONFLICT"}</span>
            </div>
          </div>
        </div>
      </div>

      <ConfidenceTierBadge tier={signal?.confidenceTier ?? "DO_NOT_BET"} label={tierLabel} />

      {/* AI Reasoning — NEW */}
      <GroqPanel />

      {/* Kalshi edge + indicators */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="text-dim text-xs font-mono uppercase mb-2">Kalshi Edge</div>
          <div className={clsx("text-3xl font-display font-black",
            signal?.kalshiEdge === "ABOVE" ? "text-green" : signal?.kalshiEdge === "BELOW" ? "text-red" : "text-amber"
          )}>{signal?.kalshiEdge ?? "NEUTRAL"}</div>
          <div className="text-dim text-xs font-mono mt-1">{signal?.kalshiConf?.toFixed(1)}% conf · {signal?.phase ?? "—"}</div>
          <div className="mt-3 space-y-1 text-[10px] font-mono">
            {([
              ["Williams %R", signal?.indicators?.williamsR?.toFixed(1), (v: number) => v > -20 ? "text-red" : v < -80 ? "text-green" : "text-amber"],
              ["CCI", signal?.indicators?.cci?.toFixed(1), (v: number) => v > 100 ? "text-red" : v < -100 ? "text-green" : "text-amber"],
              ["CMF", signal?.indicators?.cmf?.toFixed(3), (v: number) => v > 0 ? "text-green" : "text-red"],
              ["RSI", signal?.indicators?.rsi?.toFixed(1), (v: number) => v > 60 ? "text-green" : v < 40 ? "text-red" : "text-amber"],
            ] as [string, string | undefined, (v: number) => string][]).map(([label, value, colorFn]) => (
              <div key={label} className="flex justify-between text-dim">
                <span>{label}</span>
                <span className={colorFn(parseFloat(value ?? "0"))}>
                  {value ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-panel border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-dim text-xs font-mono uppercase">Trade Plan</span>
            <span className={clsx("text-[10px] font-mono px-1.5 py-0.5 rounded",
              effectiveDirection === "ABOVE" ? "bg-green/15 text-green" : "bg-red/15 text-red"
            )}>{effectiveDirection === "ABOVE" ? "LONG" : effectiveDirection === "BELOW" ? "SHORT" : "WAIT"}</span>
          </div>
          {[
            { label: "Entry", value: `$${fmt(signal?.priceEntry ?? 0)}`, color: "text-text" },
            { label: "TP1",   value: `$${fmt(signal?.tp1 ?? 0)}`,       color: "text-green" },
            { label: "TP2",   value: `$${fmt(signal?.tp2 ?? 0)}`,       color: "text-green" },
            { label: "Stop",  value: `$${fmt(signal?.stopLoss ?? 0)}`,  color: "text-red" },
            { label: "R:R",   value: `${signal?.riskReward?.toFixed(2) ?? "—"}x`, color: "text-gold" },
            { label: "ATR",   value: `$${fmt(signal?.atrValue ?? 0)}`,  color: "text-dim" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between py-1 border-b border-border/50 last:border-0">
              <span className="text-dim text-xs font-mono">{label}</span>
              <span className={clsx("text-xs font-mono font-bold num", color)}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Order Book — NEW */}
      <OrderBook />

      {/* Kelly sizer */}
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-dim text-xs font-mono uppercase tracking-widest">½ Kelly Sizer</span>
          <div className="flex items-center gap-2">
            <span className="text-dim text-xs font-mono">Bankroll $</span>
            <input
              type="number"
              value={bankrollInput}
              onChange={(e) => setBankrollInput(e.target.value)}
              onBlur={() => setBankroll(parseFloat(bankrollInput) || 25)}
              className="w-20 bg-surface border border-border rounded px-2 py-1 text-xs font-mono text-text text-right outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Probability", value: `${(kelly.prob * 100).toFixed(1)}%`, color: "text-accent" },
            { label: "½ Kelly",     value: `${(kelly.halfKelly * 100).toFixed(1)}%`, color: "text-gold" },
            { label: "Bet Size",    value: `$${kelly.betSize.toFixed(2)}`, color: "text-green" },
            { label: "Max Win",     value: `$${kelly.maxWin.toFixed(2)}`, color: "text-green" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface rounded-lg p-3 text-center">
              <div className="text-dim text-[9px] font-mono uppercase mb-1">{label}</div>
              <div className={clsx("text-lg font-mono font-bold num", color)}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bet buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => handleBet("ABOVE")} disabled={!canBet}
          className={clsx("py-4 rounded-xl font-display font-bold text-lg border-2 transition-all",
            canBet ? "border-green bg-green/15 text-green hover:bg-green/25 glow-green cursor-pointer" : "border-border/30 text-dim/30 cursor-not-allowed"
          )}>▲ LOG ABOVE</button>
        <button onClick={() => handleBet("BELOW")} disabled={!canBet}
          className={clsx("py-4 rounded-xl font-display font-bold text-lg border-2 transition-all",
            canBet ? "border-red bg-red/15 text-red hover:bg-red/25 glow-red cursor-pointer" : "border-border/30 text-dim/30 cursor-not-allowed"
          )}>▽ LOG BELOW</button>
      </div>

      {/* Pending trades */}
      {pendingLogs.length > 0 && (
        <div className="bg-panel border border-amber/30 rounded-xl p-4">
          <div className="text-amber text-xs font-mono uppercase tracking-widest mb-3">⏳ Pending — Mark Results</div>
          <div className="space-y-2">
            {pendingLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                <div className="text-xs font-mono">
                  <span className={log.direction === "ABOVE" ? "text-green" : "text-red"}>{log.direction}</span>
                  <span className="text-dim ml-2">${log.betSize.toFixed(2)} · α{log.alphaScore}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleResolve(log.id, "WIN")} className="px-3 py-1 bg-green/15 border border-green/40 text-green text-xs font-mono rounded hover:bg-green/25">WIN ✓</button>
                  <button onClick={() => handleResolve(log.id, "LOSS")} className="px-3 py-1 bg-red/15 border border-red/40 text-red text-xs font-mono rounded hover:bg-red/25">LOSS ✗</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <HourlyHeatmap />
    </div>
  );
}
