// lib/signalPipeline.ts — Enriches signals with EV and routes to execution engine

import type { SignalResult, ExecutionRecord } from "@/types";
import { executeSignal } from "./executionEngine";
import { useTerminal } from "@/store/terminal";

// Derive the best-matching Kalshi ticker from the live market list.
// Falls back to a synthesised ticker (BTC-15min-<target>-<direction>) so the
// log always shows intent even when no matching live market is loaded.
function pickTicker(
  direction: "ABOVE" | "BELOW",
  tp1: number,
  markets: { ticker: string; volume: number }[],
): string {
  const aligned = markets.filter((m) => m.ticker.toUpperCase().includes(direction));
  if (aligned.length > 0) {
    // Prefer highest-volume market aligned with the signal direction
    return aligned.sort((a, b) => b.volume - a.volume)[0].ticker;
  }
  // Synthetic fallback: round tp1 to nearest $500 strike
  const strike = Math.round(tp1 / 500) * 500;
  return `BTC-15min-${strike}-${direction}`;
}

export async function processSignal(signal: SignalResult): Promise<void> {
  const {
    autoMode, liveTradingEnabled, session,
    addExecutionRecord, kalshiMarkets,
  } = useTerminal.getState();

  if (!autoMode) return;

  // Expected value: normalised alpha × normalised confidence
  const ev = parseFloat(((signal.alphaScore / 100) * (signal.confidence / 100)).toFixed(4));

  // Current drawdown as 0-100 percentage for the circuit-breaker
  const drawdownPct = session.peakBankroll > 0
    ? ((session.peakBankroll - session.bankroll) / session.peakBankroll) * 100
    : 0;

  const sessionOpts = { isLocked: session.isLocked, drawdownPct };

  // Resolve ticker only for non-WAIT signals
  const ticker =
    signal.direction !== "WAIT"
      ? pickTicker(signal.direction, signal.tp1, kalshiMarkets)
      : undefined;

  const result = await executeSignal(
    signal,
    session.bankroll,
    liveTradingEnabled,
    sessionOpts,
    ticker,
  );

  const record: ExecutionRecord = {
    id: `ex_${Date.now()}`,
    timestamp: Date.now(),
    signal: {
      direction: signal.direction,
      alphaScore: signal.alphaScore,
      confidence: signal.confidence,
      ev,
    },
    riskGate: result.approved ? "PASSED" : "BLOCKED",
    blockReason: result.approved ? undefined : result.reason,
    fill: result.fill,
    pnlImpact: 0,
  };

  addExecutionRecord(record);
}
