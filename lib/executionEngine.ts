// lib/executionEngine.ts — Signal → Risk gate → Fill → Feedback

import type { SignalResult } from "@/types";
import { riskGate, type RiskOpts } from "./riskEngine";

export interface Fill {
  filled: boolean;
  price: number;
  size: number;
  live: boolean;
}

export interface ExecutionResult {
  approved: boolean;
  reason: string;
  fill?: Fill;
  latencyMs?: number;
}

// ½ Kelly-style sizing: 0% at alphaScore=60, scales to 10% of bankroll at 100.
// Floor is 2% of bankroll (not a fixed dollar amount) so small bankrolls are
// never accidentally over-exposed by the $0.50 hard minimum.
function computeSize(alphaScore: number, bankroll: number): number {
  const over = Math.max(0, alphaScore - 60);
  const fraction = Math.min(0.10, over / 400);
  const minSize = bankroll * 0.02; // 2% floor — scales with bankroll
  return parseFloat(Math.max(minSize, fraction * bankroll).toFixed(2));
}

function simulateFill(alphaScore: number, bankroll: number): Fill {
  return { filled: true, price: 1.0, size: computeSize(alphaScore, bankroll), live: false };
}

async function placeKalshiOrder(signal: SignalResult, size: number, ticker: string): Promise<Fill> {
  const res = await fetch("/api/kalshi/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ market: ticker, side: signal.direction, size }),
  });
  if (!res.ok) throw new Error(`Order rejected: HTTP ${res.status}`);
  const data = await res.json();
  return { filled: data.status === "FILLED", price: data.price ?? 1.0, size: data.size ?? size, live: true };
}

export async function executeSignal(
  signal: SignalResult,
  bankroll: number,
  liveTradingEnabled: boolean,
  sessionOpts: RiskOpts,
  ticker?: string,
): Promise<ExecutionResult> {
  const t0 = Date.now();
  const gate = riskGate(signal, bankroll, sessionOpts);
  if (!gate.approved) return { approved: false, reason: gate.reason };

  // Live trading requires a resolved ticker — fall back to simulated if absent
  if (liveTradingEnabled && !ticker) {
    return { approved: false, reason: "No Kalshi ticker available for live execution" };
  }

  const size = computeSize(signal.alphaScore, bankroll);
  try {
    const fill = liveTradingEnabled
      ? await placeKalshiOrder(signal, size, ticker!)
      : simulateFill(signal.alphaScore, bankroll);
    return { approved: true, reason: gate.reason, fill, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { approved: false, reason: `Execution error: ${String(err)}` };
  }
}
