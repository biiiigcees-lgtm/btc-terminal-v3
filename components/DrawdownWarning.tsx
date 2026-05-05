"use client";
// components/DrawdownWarning.tsx — Bankroll drawdown protection alerts

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function DrawdownWarning() {
  const { getDrawdownStats, session } = useTerminal();
  const dd = getDrawdownStats();

  if (dd.warningLevel === "NONE") return null;

  const config = {
    CAUTION: { bg: "bg-amber/10 border-amber/30", text: "text-amber", icon: "⚠️", msg: "Drawdown reached 15%. Consider reducing bet sizes." },
    WARNING: { bg: "bg-red/10 border-red/30", text: "text-red", icon: "🔴", msg: "Drawdown at 25%. Seriously reduce position sizes or pause." },
    DANGER: { bg: "bg-red/20 border-red/60 animate-pulse", text: "text-red", icon: "🚨", msg: "DANGER: 40%+ drawdown. Stop betting and reassess your strategy." },
  }[dd.warningLevel];

  return (
    <div className={clsx("border rounded-xl px-4 py-3", config.bg)}>
      <div className={clsx("font-mono font-bold text-sm", config.text)}>
        {config.icon} DRAWDOWN ALERT — {dd.drawdownPct}% from peak
      </div>
      <div className={clsx("font-mono text-xs mt-1 opacity-80", config.text)}>
        {config.msg} · Peak: ${dd.peakBankroll.toFixed(2)} · Current: ${session.bankroll.toFixed(2)} · Loss: ${dd.currentDrawdown.toFixed(2)}
      </div>
    </div>
  );
}
