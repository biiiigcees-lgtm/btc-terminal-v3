// lib/evEngine.ts — Expected Value Engine with risk-adjusted calculations

import type { Indicators, Candle } from "@/types";
import { KalshiProbability, KalshiSignal } from "./kalshiEngine";
import { AlphaScoreResult } from "./alphaEngine";

export interface TradeCandidate {
  type: "KALSHI" | "SPOT";
  direction: "ABOVE" | "BELOW";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  probability: number;        // 0-100
  confidence: number;         // 0-100
  timeHorizon: number;       // minutes
  risk: number;              // amount at risk
  reward: number;            // potential profit
  source: string;            // where this trade came from
}

export interface EVResult {
  ev: number;                // Expected value
  riskAdjustedEV: number;    // EV adjusted for risk
  kellyFraction: number;     // Kelly criterion fraction
  positionSize: number;      // Recommended position size
  riskReward: number;        // Risk/reward ratio
  sharpeRatio: number;       // Risk-adjusted return ratio
  maxDrawdown: number;       // Estimated max drawdown
  confidence: number;        // Confidence in EV calculation
  shouldTrade: boolean;      // Pass/fail decision
  reasons: string[];         // Why this decision was made
}

export interface EVAnalysis {
  candidate: TradeCandidate;
  ev: EVResult;
  alternatives: TradeCandidate[];
  marketContext: {
    volatility: number;
    trend: "BULL" | "BEAR" | "NEUTRAL";
    liquidity: "HIGH" | "MEDIUM" | "LOW";
    timePressure: boolean;
  };
}

// Calculate base expected value
function calculateBaseEV(probability: number, reward: number, risk: number): number {
  const winProb = probability / 100;
  const loseProb = 1 - winProb;
  return (winProb * reward) - (loseProb * risk);
}

// Calculate risk-adjusted EV using volatility and correlation
function calculateRiskAdjustedEV(
  baseEV: number,
  probability: number,
  volatility: number,
  timeHorizon: number,
  correlation: number = 0.5
): number {
  // Volatility penalty - higher volatility reduces EV certainty
  const volatilityPenalty = Math.min(0.3, volatility * 0.1);
  
  // Time decay - longer time horizons reduce EV
  const timeDecay = Math.max(0.7, 1 - (timeHorizon / 120) * 0.3);
  
  // Correlation adjustment - how correlated this trade is with overall portfolio
  const correlationAdjustment = 1 - (correlation * 0.2);
  
  return baseEV * (1 - volatilityPenalty) * timeDecay * correlationAdjustment;
}

// Calculate Kelly criterion position sizing
function calculateKelly(
  probability: number,
  reward: number,
  risk: number,
  bankroll: number = 25
): {
  kellyFraction: number;
  halfKelly: number;
  positionSize: number;
  maxLoss: number;
} {
  const winProb = probability / 100;
  const loseProb = 1 - winProb;
  const b = reward / risk; // Win/loss ratio
  
  // Full Kelly formula: f = (bp - q) / b
  const kelly = Math.max(0, (b * winProb - loseProb) / b);
  const halfKelly = kelly / 2;
  
  // Conservative position sizing
  const positionSize = Math.min(0.25, halfKelly) * bankroll;
  const maxLoss = positionSize * (risk / (risk + reward));
  
  return {
    kellyFraction: kelly,
    halfKelly,
    positionSize,
    maxLoss
  };
}

// Calculate Sharpe ratio for the trade
function calculateSharpeRatio(
  ev: number,
  volatility: number,
  riskFreeRate: number = 0.02
): number {
  if (volatility === 0) return 0;
  const annualizedEV = ev * (365 * 24 * 60); // Annualize
  const annualizedVol = volatility * Math.sqrt(365 * 24 * 60);
  return (annualizedEV - riskFreeRate) / annualizedVol;
}

// Estimate maximum drawdown
function estimateMaxDrawdown(
  probability: number,
  volatility: number,
  timeHorizon: number
): number {
  const loseProb = 1 - (probability / 100);
  const volatilityFactor = volatility * Math.sqrt(timeHorizon / 15); // Normalize to 15 min
  return loseProb * volatilityFactor * 2; // 2x volatility for stress
}

// Analyze a single trade candidate
export function analyzeEV(
  candidate: TradeCandidate,
  marketVolatility: number,
  bankroll: number = 25,
  portfolioCorrelation: number = 0.5
): EVAnalysis {
  // Calculate base metrics
  const baseEV = calculateBaseEV(candidate.probability, candidate.reward, candidate.risk);
  const riskReward = candidate.reward / candidate.risk;
  
  // Calculate risk-adjusted metrics
  const riskAdjustedEV = calculateRiskAdjustedEV(
    baseEV,
    candidate.probability,
    marketVolatility,
    candidate.timeHorizon,
    portfolioCorrelation
  );
  
  // Calculate position sizing
  const kelly = calculateKelly(candidate.probability, candidate.reward, candidate.risk, bankroll);
  
  // Calculate risk metrics
  const sharpeRatio = calculateSharpeRatio(riskAdjustedEV, marketVolatility);
  const maxDrawdown = estimateMaxDrawdown(candidate.probability, marketVolatility, candidate.timeHorizon);
  
  // Determine confidence
  const confidence = Math.min(100, candidate.confidence * (1 - marketVolatility * 0.2));
  
  // Trade decision logic
  const shouldTrade = baseEV > 0 && 
                     riskAdjustedEV > 0.01 && 
                     candidate.probability > 55 && 
                     riskReward > 1.2 && 
                     confidence > 60 &&
                     maxDrawdown < bankroll * 0.1;
  
  const reasons: string[] = [];
  if (baseEV <= 0) reasons.push("Negative expected value");
  if (riskAdjustedEV <= 0.01) reasons.push("Risk-adjusted EV too low");
  if (candidate.probability <= 55) reasons.push("Win probability too low");
  if (riskReward <= 1.2) reasons.push("Risk/reward ratio insufficient");
  if (confidence <= 60) reasons.push("Low confidence in signal");
  if (maxDrawdown >= bankroll * 0.1) reasons.push("Potential drawdown too high");
  if (shouldTrade && reasons.length === 0) reasons.push("All criteria passed");
  
  const ev: EVResult = {
    ev: Math.round(baseEV * 100) / 100,
    riskAdjustedEV: Math.round(riskAdjustedEV * 100) / 100,
    kellyFraction: Math.round(kelly.kellyFraction * 100) / 100,
    positionSize: Math.round(kelly.positionSize * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    confidence: Math.round(confidence),
    shouldTrade,
    reasons
  };
  
  // Determine market context
  const trend: "BULL" | "BEAR" | "NEUTRAL" = 
    candidate.direction === "ABOVE" ? "BULL" : 
    candidate.direction === "BELOW" ? "BEAR" : "NEUTRAL";
  
  const liquidity = marketVolatility < 0.02 ? "HIGH" : 
                   marketVolatility < 0.05 ? "MEDIUM" : "LOW";
  
  const timePressure = candidate.timeHorizon < 5;
  
  return {
    candidate,
    ev,
    alternatives: [], // Would be populated with other candidates
    marketContext: {
      volatility: marketVolatility,
      trend,
      liquidity,
      timePressure
    }
  };
}

// Create trade candidate from Kalshi signal
export function createKalshiCandidate(
  kalshi: KalshiSignal,
  currentPrice: number
): TradeCandidate {
  const { round, probability, recommendation } = kalshi;
  
  if (recommendation === "NO_BET") {
    throw new Error("Cannot create candidate from NO_BET recommendation");
  }
  
  const direction = recommendation === "BET_YES" ? 
    (round.direction === "ABOVE" ? "ABOVE" : "BELOW") :
    (round.direction === "ABOVE" ? "BELOW" : "ABOVE");
  
  return {
    type: "KALSHI",
    direction,
    entryPrice: currentPrice,
    targetPrice: round.targetPrice,
    stopLoss: currentPrice, // Binary options have fixed risk
    probability: recommendation === "BET_YES" ? probability.yesProbability : probability.noProbability,
    confidence: probability.confidence,
    timeHorizon: round.timeRemaining,
    risk: 1, // Binary options have fixed risk
    reward: 1, // Binary options have fixed reward
    source: `Kalshi-${round.ticker}`
  };
}

// Create trade candidate from alpha signal
export function createAlphaCandidate(
  alpha: AlphaScoreResult,
  currentPrice: number,
  indicators: Indicators
): TradeCandidate {
  const atr = indicators.atr;
  const direction = alpha.direction;
  
  if (direction === "WAIT") {
    throw new Error("Cannot create candidate from WAIT signal");
  }
  
  // Calculate targets based on ATR
  const tp1 = direction === "ABOVE" ? currentPrice + atr * 1.5 : currentPrice - atr * 1.5;
  const stopLoss = direction === "ABOVE" ? currentPrice - atr * 0.8 : currentPrice + atr * 0.8;
  
  return {
    type: "SPOT",
    direction,
    entryPrice: currentPrice,
    targetPrice: tp1,
    stopLoss,
    probability: alpha.confidence,
    confidence: alpha.confidence,
    timeHorizon: 30, // 30 minutes for spot trades
    risk: Math.abs(currentPrice - stopLoss),
    reward: Math.abs(tp1 - currentPrice),
    source: "Alpha-Engine"
  };
}

// Compare multiple trade candidates and select best
export function selectBestTrade(
  candidates: TradeCandidate[],
  marketVolatility: number,
  bankroll: number = 25
): EVAnalysis | null {
  if (!candidates.length) return null;
  
  // Analyze all candidates
  const analyses = candidates.map(candidate => 
    analyzeEV(candidate, marketVolatility, bankroll)
  );
  
  // Filter to only viable trades
  const viableTrades = analyses.filter(analysis => analysis.ev.shouldTrade);
  
  if (!viableTrades.length) return null;
  
  // Sort by risk-adjusted EV
  viableTrades.sort((a, b) => b.ev.riskAdjustedEV - a.ev.riskAdjustedEV);
  
  // Return the best trade
  const best = viableTrades[0];
  best.alternatives = viableTrades.slice(1).map(t => t.candidate);
  
  return best;
}

// Calculate portfolio-level EV
export function calculatePortfolioEV(
  trades: EVAnalysis[],
  correlations: number[][] = []
): {
  totalEV: number;
  totalRisk: number;
  portfolioSharpe: number;
  diversificationBenefit: number;
  recommendedAllocation: { trade: EVAnalysis; weight: number }[];
} {
  if (!trades.length) {
    return {
      totalEV: 0,
      totalRisk: 0,
      portfolioSharpe: 0,
      diversificationBenefit: 0,
      recommendedAllocation: []
    };
  }
  
  const totalEV = trades.reduce((sum, trade) => sum + trade.ev.ev, 0);
  const totalRisk = trades.reduce((sum, trade) => sum + trade.ev.maxDrawdown, 0);
  
  // Simple portfolio Sharpe (would be more complex with real correlations)
  const portfolioSharpe = totalRisk > 0 ? totalEV / totalRisk : 0;
  
  // Estimate diversification benefit
  const uncorrelatedEV = trades.reduce((sum, trade) => sum + Math.abs(trade.ev.ev), 0);
  const diversificationBenefit = uncorrelatedEV > 0 ? (totalEV / uncorrelatedEV - 1) * 100 : 0;
  
  // Simple equal-weight allocation (would optimize in production)
  const weight = 1 / trades.length;
  const recommendedAllocation = trades.map(trade => ({
    trade,
    weight: Math.round(weight * 100) / 100
  }));
  
  return {
    totalEV: Math.round(totalEV * 100) / 100,
    totalRisk: Math.round(totalRisk * 100) / 100,
    portfolioSharpe: Math.round(portfolioSharpe * 100) / 100,
    diversificationBenefit: Math.round(diversificationBenefit * 10) / 10,
    recommendedAllocation
  };
}
