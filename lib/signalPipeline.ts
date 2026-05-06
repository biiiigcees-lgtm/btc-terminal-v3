// lib/signalPipeline.ts — Enriches signals with EV and routes to execution engine

import type { SignalResult, ExecutionRecord } from "@/types";
import { executeSignal } from "./executionEngine";
import { useTerminal } from "@/store/terminal";

export async function processSignal(signal: SignalResult): Promise<void> {
  const { autoMode, liveTradingEnabled, session, addExecutionRecord } = useTerminal.getState();
  if (!autoMode) return;

  // Expected value: normalised alpha × normalised confidence
  const ev = parseFloat(((signal.alphaScore / 100) * (signal.confidence / 100)).toFixed(4));
  const result = await executeSignal(signal, session.bankroll, liveTradingEnabled);

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
