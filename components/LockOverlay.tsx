"use client";
// components/LockOverlay.tsx — 30-min cooldown after 3 consecutive losses

import { useState, useEffect } from "react";
import { useTerminal } from "@/store/terminal";

export function LockOverlay() {
  const { session, unlockManual } = useTerminal();
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const tick = () => {
      if (!session.lockUntil) return;
      const ms = session.lockUntil - Date.now();
      if (ms <= 0) { unlockManual(); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.lockUntil, unlockManual]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center lock-overlay">
      <div className="bg-surface border border-red/50 rounded-2xl p-8 max-w-sm text-center space-y-4 glow-red">
        <div className="text-6xl">🔒</div>
        <div className="text-red font-display font-bold text-2xl">COOLDOWN ACTIVE</div>
        <div className="text-dim font-mono text-sm">{session.lockReason}</div>
        {timeLeft && (
          <div className="text-red font-mono text-4xl font-bold num">{timeLeft}</div>
        )}
        <div className="text-dim text-xs font-mono">
          Tilt is the #1 account killer.<br />
          This lock is protecting your bankroll.
        </div>
        <button
          onClick={unlockManual}
          className="mt-2 px-4 py-2 border border-red/30 text-red/50 text-xs font-mono rounded hover:border-red/60 hover:text-red transition-all"
        >
          Override (not recommended)
        </button>
      </div>
    </div>
  );
}
