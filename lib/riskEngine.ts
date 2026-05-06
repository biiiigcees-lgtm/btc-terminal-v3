// lib/riskEngine.ts — Hard safety gate for auto execution

import type { SignalResult } from "@/types";

export interface RiskDecision {
  approved: boolean;
  reason: string;
}

export const RISK_LIMITS = {
  minAlphaScore: 60,
  minConfidence: 60,
  maxExposurePct: 0.20,
  maxDrawdownPct: 0.05,
} as const;

// Mirrors the manual planner gate — only BET and HIGH_CONVICTION tiers execute
export function riskGate(signal: SignalResult, _bankroll: number): RiskDecision {
  if (signal.direction === "WAIT") {
    return { approved: false, reason: "Signal direction is WAIT" };
  }

  if (signal.confidenceTier !== "BET" && signal.confidenceTier !== "HIGH_CONVICTION") {
    return { approved: false, reason: `Tier blocked: ${signal.confidenceTier}` };
  }

  if (signal.alphaScore < RISK_LIMITS.minAlphaScore) {
    return { approved: false, reason: `Alpha ${signal.alphaScore} < min ${RISK_LIMITS.minAlphaScore}` };
  }

  if (signal.confidence < RISK_LIMITS.minConfidence) {
    return { approved: false, reason: `Confidence ${signal.confidence} < min ${RISK_LIMITS.minConfidence}` };
  }

  // ATR gate blocks execution when volatility is too high for safe fills
  if (!signal.atrGate) {
    return { approved: false, reason: "ATR gate: volatility too high for safe execution" };
  }

  if (!signal.timeWindowGood) {
    return { approved: false, reason: `Time window blocked: ${signal.timeWindowLabel}` };
  }

  return { approved: true, reason: "All risk checks passed" };
}
