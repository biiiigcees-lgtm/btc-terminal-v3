// lib/weightOptimizer.ts — Auto weight optimizer (Learning System v2)
// Analyzes resolved signal accuracy to dynamically tune consensus agent weights.

import type { SignalAccuracyEntry, AgentWeights, WeightOptimizationResult } from "@/types";

export const BASE_WEIGHTS: AgentWeights = {
  momentum: 0.25,
  volatility: 0.20,
  meanReversion: 0.20,
  orderFlow: 0.15,
  kalshi: 0.20,
  lastUpdated: 0,
  totalTrades: 0,
};

function normalize(w: Omit<AgentWeights, "lastUpdated" | "totalTrades">): Omit<AgentWeights, "lastUpdated" | "totalTrades"> {
  const sum = w.momentum + w.volatility + w.meanReversion + w.orderFlow + w.kalshi;
  if (sum === 0) return w;
  return {
    momentum:      parseFloat((w.momentum / sum).toFixed(4)),
    volatility:    parseFloat((w.volatility / sum).toFixed(4)),
    meanReversion: parseFloat((w.meanReversion / sum).toFixed(4)),
    orderFlow:     parseFloat((w.orderFlow / sum).toFixed(4)),
    kalshi:        parseFloat((w.kalshi / sum).toFixed(4)),
  };
}

export function optimizeWeights(accuracyLog: SignalAccuracyEntry[]): WeightOptimizationResult {
  const resolved = accuracyLog.filter((e) => e.resolved && e.correct !== null);

  if (resolved.length < 10) {
    return {
      currentWeights: BASE_WEIGHTS,
      optimizedWeights: BASE_WEIGHTS,
      improvement: 0,
      confidence: 0,
      basedOnTrades: resolved.length,
      insights: [`Need at least 10 resolved signals to optimize (have ${resolved.length})`],
      performanceByBracket: {},
    };
  }

  // ── Performance by alpha bracket ──────────────────────────────────────────
  const byBracket: Record<string, { wins: number; total: number }> = {};
  for (const entry of resolved) {
    const floor = Math.floor(entry.alpha / 10) * 10;
    const key = `${floor}-${floor + 9}`;
    if (!byBracket[key]) byBracket[key] = { wins: 0, total: 0 };
    byBracket[key].total++;
    if (entry.correct) byBracket[key].wins++;
  }

  // ── Performance by confidence tier ────────────────────────────────────────
  const byTier: Record<string, { wins: number; total: number }> = {};
  for (const entry of resolved) {
    const t = entry.confidenceTier ?? "UNKNOWN";
    if (!byTier[t]) byTier[t] = { wins: 0, total: 0 };
    byTier[t].total++;
    if (entry.correct) byTier[t].wins++;
  }

  // ── Recent vs overall trends ───────────────────────────────────────────────
  const recent = resolved.slice(0, Math.min(20, resolved.length));
  const recentWinRate = recent.filter((e) => e.correct).length / recent.length;
  const overallWinRate = resolved.filter((e) => e.correct).length / resolved.length;
  const trend = recentWinRate - overallWinRate; // positive = improving

  const highConvRate = byTier["HIGH_CONVICTION"]
    ? byTier["HIGH_CONVICTION"].wins / byTier["HIGH_CONVICTION"].total
    : 0.5;
  const betRate = byTier["BET"]
    ? byTier["BET"].wins / byTier["BET"].total
    : 0.5;

  // ── Compute weight deltas ─────────────────────────────────────────────────
  // Momentum: boost if recent signals are beating overall; cut if declining
  const momentumDelta = trend > 0.1 ? 0.06 : trend < -0.1 ? -0.06 : trend * 0.4;

  // Kalshi: boost if HIGH_CONVICTION signals are accurate
  const kalshiDelta = highConvRate > 0.65 ? 0.06 : highConvRate < 0.45 ? -0.06 : (highConvRate - 0.5) * 0.4;

  // Mean reversion: boost when trending signals are failing
  const meanRevDelta = betRate < 0.45 ? 0.05 : betRate > 0.65 ? -0.03 : 0;

  // Volatility: boost when overall accuracy is low (market more noisy)
  const volatilityDelta = overallWinRate < 0.48 ? 0.04 : overallWinRate > 0.65 ? -0.03 : 0;

  // Order flow: mild boost if recent is strong
  const orderFlowDelta = recentWinRate > 0.6 ? 0.03 : 0;

  const raw = {
    momentum:      Math.max(0.05, Math.min(0.45, BASE_WEIGHTS.momentum + momentumDelta)),
    volatility:    Math.max(0.05, Math.min(0.40, BASE_WEIGHTS.volatility + volatilityDelta)),
    meanReversion: Math.max(0.05, Math.min(0.40, BASE_WEIGHTS.meanReversion + meanRevDelta)),
    orderFlow:     Math.max(0.05, Math.min(0.30, BASE_WEIGHTS.orderFlow + orderFlowDelta)),
    kalshi:        Math.max(0.05, Math.min(0.40, BASE_WEIGHTS.kalshi + kalshiDelta)),
  };

  const normalized = normalize(raw);

  const optimizedWeights: AgentWeights = {
    ...normalized,
    lastUpdated: Date.now(),
    totalTrades: resolved.length,
  };

  // ── Compute improvement delta ─────────────────────────────────────────────
  const keys: (keyof typeof raw)[] = ["momentum", "volatility", "meanReversion", "orderFlow", "kalshi"];
  const improvement = keys.reduce((acc, k) => acc + Math.abs(normalized[k] - BASE_WEIGHTS[k]), 0) / keys.length * 100;

  // ── Build insights ────────────────────────────────────────────────────────
  const insights: string[] = [];
  if (recentWinRate > 0.65)
    insights.push(`Recent signals strong (${(recentWinRate * 100).toFixed(0)}%) — boosting momentum weight`);
  if (recentWinRate < 0.42)
    insights.push(`Recent signals weak (${(recentWinRate * 100).toFixed(0)}%) — cut momentum, raised mean-reversion`);
  if (highConvRate > 0.65)
    insights.push(`HIGH_CONVICTION tier reliable (${(highConvRate * 100).toFixed(0)}%) — Kalshi weight increased`);
  if (highConvRate < 0.45)
    insights.push(`HIGH_CONVICTION tier unreliable (${(highConvRate * 100).toFixed(0)}%) — Kalshi weight reduced`);
  if (trend > 0.12)
    insights.push("System accuracy improving — recent trades outperforming baseline");
  if (trend < -0.12)
    insights.push("System accuracy declining — shifting weight toward mean-reversion");
  if (overallWinRate > 0.62)
    insights.push(`Overall win rate healthy: ${(overallWinRate * 100).toFixed(0)}%`);
  if (insights.length === 0)
    insights.push("Weights near optimal — performance is stable");

  // ── Performance by bracket output ─────────────────────────────────────────
  const performanceByBracket: WeightOptimizationResult["performanceByBracket"] = {};
  for (const [key, data] of Object.entries(byBracket)) {
    performanceByBracket[key] = {
      accuracy: Math.round((data.wins / data.total) * 100),
      trades: data.total,
      weight: parseFloat((data.total / resolved.length).toFixed(3)),
    };
  }

  return {
    currentWeights: BASE_WEIGHTS,
    optimizedWeights,
    improvement: parseFloat(improvement.toFixed(2)),
    confidence: Math.min(100, Math.round(resolved.length * 4)),
    basedOnTrades: resolved.length,
    insights,
    performanceByBracket,
  };
}

export function computeSimulatedPnLStats(
  log: SignalAccuracyEntry[],
  baseBet: number = 1.0
): {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnL: number;
  peakPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  equityCurve: { timestamp: number; pnl: number }[];
} {
  const resolved = [...log]
    .filter((e) => e.resolved && e.correct !== null && e.direction !== "WAIT")
    .sort((a, b) => a.timestamp - b.timestamp);

  if (resolved.length === 0) {
    return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, netPnL: 0, peakPnL: 0, maxDrawdown: 0, sharpeRatio: 0, equityCurve: [] };
  }

  let runningPnL = 0;
  let peakPnL = 0;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  const equityCurve: { timestamp: number; pnl: number }[] = [];
  const returns: number[] = [];

  for (const e of resolved) {
    const pnl = e.correct ? baseBet : -baseBet;
    runningPnL = parseFloat((runningPnL + pnl).toFixed(4));
    returns.push(pnl);

    if (runningPnL > peakPnL) peakPnL = runningPnL;
    const drawdown = peakPnL - runningPnL;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (e.correct) wins++;
    else losses++;

    equityCurve.push({ timestamp: e.timestamp, pnl: runningPnL });
  }

  const winRate = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;

  // Sharpe (simplified — mean return / std dev of returns)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  const sharpeRatio = std > 0 ? parseFloat((mean / std).toFixed(3)) : 0;

  return {
    totalTrades: resolved.length,
    wins,
    losses,
    winRate,
    netPnL: parseFloat(runningPnL.toFixed(2)),
    peakPnL: parseFloat(peakPnL.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    sharpeRatio,
    equityCurve,
  };
}
