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
  maxDrawdownPct: 0.05, // halt auto trading if drawdown exceeds 5%
} as const;

export interface RiskOpts {
  isLocked: boolean;   // session loss-lock (3 consecutive losses)
  drawdownPct: number; // current drawdown as 0-100 percentage
}

// Mirrors the manual planner gate — only BET and HIGH_CONVICTION tiers execute
export function riskGate(signal: SignalResult, bankroll: number, opts: RiskOpts): RiskDecision {
  // Session loss-lock — same check as the manual planner
  if (opts.isLocked) {
    return { approved: false, reason: "Session locked — 30-min cooldown active" };
  }

  // Drawdown circuit-breaker
  if (opts.drawdownPct >= RISK_LIMITS.maxDrawdownPct * 100) {
    return {
      approved: false,
      reason: `Drawdown ${opts.drawdownPct.toFixed(0)}% ≥ ${RISK_LIMITS.maxDrawdownPct * 100}% halt limit`,
    };
  }

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

  // Bankroll floor — refuse if bankroll is too small to size meaningfully
  if (bankroll < 1) {
    return { approved: false, reason: `Bankroll $${bankroll.toFixed(2)} below $1 floor` };
  }

  return { approved: true, reason: "All risk checks passed" };
}
