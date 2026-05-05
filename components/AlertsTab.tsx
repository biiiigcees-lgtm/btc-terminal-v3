"use client";
// components/AlertsTab.tsx

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function AlertsTab() {
  const { signal, session } = useTerminal();

  const alerts = [
    signal?.confidenceTier === "HIGH_CONVICTION" && {
      type: "SUCCESS" as const, title: "💎 HIGH CONVICTION SIGNAL", msg: `Alpha ${signal.alphaScore} — All gates clear. Bet size: ${signal.direction}`,
    },
    !signal?.atrGate && {
      type: "DANGER" as const, title: "🔴 ATR VOLATILITY GATE CLOSED", msg: "ATR spike detected. Current volatility is 1.5x average. Skip this window.",
    },
    !signal?.timeWindowGood && {
      type: "WARN" as const, title: "⏰ BAD TIME WINDOW", msg: `${signal?.timeWindowLabel ?? "Unknown window"} — Low liquidity. Directional signals unreliable.`,
    },
    !signal?.htfAligned && {
      type: "WARN" as const, title: "📊 HTF CONFLICT", msg: `1H/4H bias does not align with 15M signal. Wait for alignment.`,
    },
    session.isLocked && {
      type: "DANGER" as const, title: "🔒 ACCOUNT LOCKED", msg: `3 consecutive losses. 30-minute cooldown active. Protecting your bankroll.`,
    },
    session.consecutiveWins >= 3 && {
      type: "WARN" as const, title: "⚡ WIN STREAK WARNING", msg: `${session.consecutiveWins} consecutive wins. Reduce bet size — overconfidence is dangerous.`,
    },
    (signal?.alphaScore ?? 0) >= 70 && signal?.atrGate && signal?.timeWindowGood && signal?.htfAligned && {
      type: "SUCCESS" as const, title: "✅ ALL SYSTEMS GO", msg: `Alpha ${signal.alphaScore} · ATR safe · Time window good · HTF aligned. Strong signal.`,
    },
  ].filter(Boolean) as { type: "SUCCESS" | "WARN" | "DANGER"; title: string; msg: string }[];

  const colors = {
    SUCCESS: "bg-green/10 border-green/30 text-green",
    WARN: "bg-amber/10 border-amber/30 text-amber",
    DANGER: "bg-red/10 border-red/30 text-red",
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-display font-bold">ALERTS</h1>
      {alerts.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl p-8 text-center text-dim font-mono text-sm">
          No active alerts. Terminal is monitoring...
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a, i) => (
            <div key={i} className={clsx("border rounded-xl px-4 py-3", colors[a.type])}>
              <div className="font-mono font-bold text-sm">{a.title}</div>
              <div className="text-xs font-mono opacity-80 mt-1">{a.msg}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
