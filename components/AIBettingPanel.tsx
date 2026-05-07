"use client";
// components/AIBettingPanel.tsx — AI betting suggestions via Groq

import { useState, useEffect, useCallback, useRef } from "react";
import clsx from "clsx";
import type { SignalResult } from "@/types";

interface AIBettingPanelProps {
  price: number;
  signal: SignalResult | null;
  ema9: number;
  ema21: number;
  crossoverStatus: string;
  candlesSinceCross: number;
}

interface AIResult {
  action: "BUY" | "SELL" | "WAIT";
  timing: string;
  reasoning: string;
  keyFactors: string[];
  risks: string[];
  confidence: string;
  timestamp: number;
}

const REFRESH_INTERVAL = 30_000;

export function AIBettingPanel({ price, signal, ema9, ema21, crossoverStatus, candlesSinceCross }: AIBettingPanelProps) {
  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAI = useCallback(async () => {
    if (!price || !signal) return;
    setLoading(true);
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price,
          signal,
          indicators: signal.indicators,
          ema9,
          ema21,
          crossoverStatus,
          candlesSinceCross,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setSecondsAgo(0);
      }
    } catch {
      // silently ignore — panel stays with last result
    } finally {
      setLoading(false);
    }
  }, [price, signal, ema9, ema21, crossoverStatus, candlesSinceCross]);

  // Initial fetch + 30s interval
  useEffect(() => {
    fetchAI();
    timerRef.current = setInterval(fetchAI, REFRESH_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAI]);

  // Seconds-ago counter
  useEffect(() => {
    const id = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const actionColor =
    result?.action === "BUY" ? "text-green" :
    result?.action === "SELL" ? "text-red" : "text-amber";

  const actionBg =
    result?.action === "BUY" ? "bg-green/10 border-green/30" :
    result?.action === "SELL" ? "bg-red/10 border-red/30" : "bg-amber/10 border-amber/30";

  const actionIcon =
    result?.action === "BUY" ? "▲" :
    result?.action === "SELL" ? "▼" : "◆";

  const confidenceColor =
    result?.confidence === "HIGH_CONVICTION" ? "text-green" :
    result?.confidence === "BET" ? "text-green" :
    result?.confidence === "MARGINAL" ? "text-amber" :
    result?.confidence === "DO_NOT_BET" ? "text-red" : "text-dim";

  return (
    <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-dim text-[10px] font-mono uppercase tracking-widest">AI Suggestions</span>
        <div className="flex items-center gap-1.5">
          {loading && (
            <span className="text-[9px] font-mono text-accent animate-pulse">analyzing…</span>
          )}
          {!loading && result && (
            <span className="text-[9px] font-mono text-dim">{secondsAgo}s ago</span>
          )}
          <button
            onClick={fetchAI}
            disabled={loading}
            className="text-[9px] font-mono text-dim hover:text-accent transition-colors disabled:opacity-40"
            title="Refresh AI analysis"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Action badge */}
      {result ? (
        <>
          <div className={clsx("rounded-lg p-3 border flex items-center justify-between", actionBg)}>
            <div className="flex items-center gap-2">
              <span className={clsx("text-2xl font-mono font-bold", actionColor)}>{actionIcon}</span>
              <div>
                <div className={clsx("text-xl font-mono font-bold leading-none", actionColor)}>{result.action}</div>
                <div className={clsx("text-[10px] font-mono mt-0.5", confidenceColor)}>
                  {result.confidence?.replace("_", " ")}
                </div>
              </div>
            </div>
            {result.timing && (
              <div className="text-right">
                <div className="text-dim text-[8px] font-mono uppercase">Timing</div>
                <div className="text-text text-[10px] font-mono font-bold mt-0.5">{result.timing}</div>
              </div>
            )}
          </div>

          {/* Reasoning */}
          {result.reasoning && (
            <div className="bg-panel rounded p-2.5 border border-border">
              <div className="text-dim text-[9px] font-mono uppercase mb-1">Analysis</div>
              <p className="text-text text-[11px] font-body leading-relaxed">{result.reasoning}</p>
            </div>
          )}

          {/* Key factors */}
          {result.keyFactors && result.keyFactors.length > 0 && (
            <div className="bg-panel rounded p-2.5 border border-border">
              <div className="text-dim text-[9px] font-mono uppercase mb-1.5">Key Factors</div>
              <ul className="space-y-1">
                {result.keyFactors.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] font-mono text-text">
                    <span className="text-accent mt-0.5 shrink-0">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {result.risks && result.risks.length > 0 && (
            <div className="bg-panel rounded p-2.5 border border-red/10">
              <div className="text-red/60 text-[9px] font-mono uppercase mb-1.5">Risks</div>
              <ul className="space-y-1">
                {result.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] font-mono text-red/80">
                    <span className="mt-0.5 shrink-0">⚠</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Auto-refresh note */}
          <div className="flex items-center justify-between">
            <span className="text-dim text-[9px] font-mono">Auto-refreshes every 30s</span>
            <div className="h-0.5 flex-1 mx-2 bg-border rounded overflow-hidden">
              <div
                className="h-full bg-accent/40 transition-none"
                style={{ width: `${Math.min(100, (secondsAgo / 30) * 100)}%`, transition: "width 1s linear" }}
              />
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="bg-panel rounded p-4 border border-border flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="text-dim text-[10px] font-mono">Analyzing market…</span>
        </div>
      ) : (
        <div className="bg-panel rounded p-3 border border-border">
          <p className="text-dim text-[10px] font-mono">
            {!signal ? "Waiting for signal data…" : "Add GROQ_API_KEY to enable AI analysis."}
          </p>
        </div>
      )}
    </div>
  );
}
