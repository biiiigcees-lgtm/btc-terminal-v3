// lib/kalshiEngine.ts — Kalshi Probability Engine with time decay and urgency mode

import type { Candle, Indicators } from "@/types";

export interface KalshiRound {
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  impliedProb: number;
  volume: number;
  expiresAt: string;
  targetPrice: number;
  direction: "ABOVE" | "BELOW";
  timeRemaining: number; // minutes
  status: "ACTIVE" | "SETTLED" | "EXPIRED";
}

export interface KalshiProbability {
  yesProbability: number;     // 0-100
  noProbability: number;      // 0-100
  marketProbability: number;  // 0-100
  edge: number;               // -100 to 100, positive = good trade
  edgeDirection: "ABOVE" | "BELOW" | "NEUTRAL";
  confidence: number;         // 0-100
  urgencyMode: boolean;       // < 2 minutes remaining
  distanceToTarget: number;   // absolute price distance
  requiredMovePerMin: number; // price movement needed per minute
  timeDecayFactor: number;    // 0-1, how much time decay affects probability
  adjustedProbability: number; // probability adjusted for time decay
  feasibilityScore: number;   // 0-100, higher = more feasible
  urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  isTargetUnrealistic: boolean;
  warning: string | null;
}

export interface KalshiSignal {
  round: KalshiRound;
  probability: KalshiProbability;
  recommendation: "BET_YES" | "BET_NO" | "NO_BET";
  expectedValue: number;
  riskReward: number;
  kellyFraction: number;
}

// Calculate time decay factor based on remaining time
function calculateTimeDecay(timeRemaining: number): number {
  if (timeRemaining <= 0) return 0;
  if (timeRemaining >= 15) return 1; // No decay for 15+ minutes
  
  // Linear decay for < 15 minutes
  return timeRemaining / 15;
}

// Calculate required move per minute
function calculateRequiredMovePerMin(
  currentPrice: number,
  targetPrice: number,
  timeRemaining: number
): number {
  if (timeRemaining <= 0) return Infinity;
  const distance = Math.abs(targetPrice - currentPrice);
  return distance / timeRemaining;
}

// Calculate volatility-adjusted probability
function calculateVolatilityAdjustedProbability(
  baseProbability: number,
  atr: number,
  currentPrice: number,
  timeRemaining: number
): number {
  // Volatility factor - higher ATR increases probability of reaching target
  const volatilityFactor = Math.min(2, (atr / currentPrice) * 100);
  
  // Time factor - less time = lower probability
  const timeFactor = Math.min(1, timeRemaining / 15);
  
  // Adjust base probability
  const adjustedProb = baseProbability * (1 + (volatilityFactor - 1) * 0.5) * timeFactor;
  
  return Math.max(0, Math.min(100, adjustedProb));
}

// Calculate momentum-adjusted probability
function calculateMomentumAdjustedProbability(
  baseProbability: number,
  indicators: Indicators,
  direction: "ABOVE" | "BELOW"
): number {
  let momentumBonus = 0;
  
  // RSI momentum
  if (direction === "ABOVE") {
    if (indicators.rsi > 50 && indicators.rsi < 70) momentumBonus += 5;
    if (indicators.momentum > 0.5) momentumBonus += 3;
    if (indicators.macd > indicators.macdSignal) momentumBonus += 3;
  } else {
    if (indicators.rsi < 50 && indicators.rsi > 30) momentumBonus += 5;
    if (indicators.momentum < -0.5) momentumBonus += 3;
    if (indicators.macd < indicators.macdSignal) momentumBonus += 3;
  }
  
  return Math.max(0, Math.min(100, baseProbability + momentumBonus));
}

// Main probability calculation
export function calculateKalshiProbability(
  round: KalshiRound,
  currentPrice: number,
  indicators: Indicators,
  candles: Candle[]
): KalshiProbability {
  const { targetPrice, direction, timeRemaining, yesPrice, noPrice } = round;
  
  // Base probability from market pricing
  const baseYesProb = yesPrice * 100;
  const baseNoProb = noPrice * 100;
  
  // Calculate distance to target
  const distanceToTarget = Math.abs(targetPrice - currentPrice);
  const currentDistancePct = (distanceToTarget / currentPrice) * 100;
  
  // Required move per minute
  const requiredMovePerMin = calculateRequiredMovePerMin(currentPrice, targetPrice, timeRemaining);
  
  // Time decay factor
  const timeDecayFactor = calculateTimeDecay(timeRemaining);
  
  // Urgency mode (< 2 minutes)
  const urgencyMode = timeRemaining < 2;
  
  // Get ATR for volatility adjustment
  const atr = indicators.atr;
  
  // Calculate volatility-adjusted probability
  const volatilityAdjustedProb = calculateVolatilityAdjustedProbability(
    direction === "ABOVE" ? baseYesProb : baseNoProb,
    atr,
    currentPrice,
    timeRemaining
  );
  
  // Calculate momentum-adjusted probability
  const momentumAdjustedProb = calculateMomentumAdjustedProbability(
    volatilityAdjustedProb,
    indicators,
    direction
  );
  
  // Final adjusted probability with time decay
  const adjustedProbability = momentumAdjustedProb * timeDecayFactor;
  
  // Calculate edge
  const marketImpliedProb = direction === "ABOVE" ? baseYesProb : baseNoProb;
  const edge = adjustedProbability - marketImpliedProb;
  
  // Determine edge direction
  let edgeDirection: "ABOVE" | "BELOW" | "NEUTRAL" = "NEUTRAL";
  if (edge > 5) edgeDirection = direction;
  else if (edge < -5) edgeDirection = direction === "ABOVE" ? "BELOW" : "ABOVE";
  
  // Confidence based on edge magnitude and time remaining
  const edgeMagnitude = Math.abs(edge);
  const timeConfidence = Math.min(100, (timeRemaining / 15) * 100);
  const confidence = Math.round((edgeMagnitude * 0.7 + timeConfidence * 0.3));
  
  // Calculate feasibility score
  const feasibilityScore = calculateFeasibilityScore(distanceToTarget, requiredMovePerMin, timeRemaining);
  
  // Determine urgency level
  const urgencyLevel = determineUrgencyLevel(timeRemaining, requiredMovePerMin);
  
  // Check if target is unrealistic
  const isTargetUnrealistic = requiredMovePerMin > 100 || (distanceToTarget / currentPrice) > 0.02; // >2% move
  
  // Generate warning if needed
  let warning: string | null = null;
  if (isTargetUnrealistic) {
    warning = "Target unlikely given time remaining";
    // Cap probability at 30% for unrealistic targets
    adjustedYesProb = Math.min(adjustedYesProb, 30);
    adjustedNoProb = 100 - adjustedYesProb;
  }
  
  return {
    yesProbability: Math.round(adjustedYesProb),
    noProbability: Math.round(adjustedNoProb),
    marketProbability: round.impliedProb,
    edge: Math.round(edge * 10) / 10,
    edgeDirection,
    confidence,
    urgencyMode,
    distanceToTarget,
    requiredMovePerMin,
    timeDecayFactor,
    adjustedProbability: Math.round(adjustedYesProb * 10) / 10,
    feasibilityScore,
    urgencyLevel,
    isTargetUnrealistic,
    warning
  };
}

// Generate Kalshi signal with EV calculation
export function generateKalshiSignal(
  round: KalshiRound,
  currentPrice: number,
  indicators: Indicators,
  candles: Candle[],
  bankroll: number = 25
): KalshiSignal {
  const probability = calculateKalshiProbability(round, currentPrice, indicators, candles);
  
  // Determine recommendation
  let recommendation: "BET_YES" | "BET_NO" | "NO_BET" = "NO_BET";
  if (probability.edge > 8 && probability.confidence > 60) {
    recommendation = round.direction === "ABOVE" ? "BET_YES" : "BET_NO";
  } else if (probability.edge < -8 && probability.confidence > 60) {
    recommendation = round.direction === "ABOVE" ? "BET_NO" : "BET_YES";
  }
  
  // Calculate expected value
  const winProb = recommendation === "BET_YES" ? probability.yesProbability / 100 : probability.noProbability / 100;
  const loseProb = 1 - winProb;
  const payout = 1; // Kalshi binary payout
  const risk = 1;
  const expectedValue = (winProb * payout) - (loseProb * risk);
  
  // Calculate risk/reward ratio
  const riskReward = Math.abs(payout / risk);
  
  // Calculate Kelly fraction
  const kellyFraction = Math.max(0, Math.min(0.25, expectedValue / risk));
  
  return {
    round,
    probability,
    recommendation,
    expectedValue: Math.round(expectedValue * 100) / 100,
    riskReward,
    kellyFraction
  };
}

// Get best available Kalshi trade
export function getBestKalshiTrade(
  rounds: KalshiRound[],
  currentPrice: number,
  indicators: Indicators,
  candles: Candle[],
  bankroll: number = 25
): KalshiSignal | null {
  if (!rounds.length) return null;
  
  // Generate signals for all active rounds
  const signals = rounds
    .filter(round => round.status === "ACTIVE" && round.timeRemaining > 0)
    .map(round => generateKalshiSignal(round, currentPrice, indicators, candles, bankroll))
    .filter(signal => signal.recommendation !== "NO_BET");
  
  if (!signals.length) return null;
  
  // Sort by expected value
  signals.sort((a, b) => b.expectedValue - a.expectedValue);
  
  return signals[0];
}

// Simulate Kalshi round outcome for backtesting
export function simulateKalshiOutcome(
  round: KalshiRound,
  finalPrice: number
): "YES" | "NO" {
  if (round.direction === "ABOVE") {
    return finalPrice > round.targetPrice ? "YES" : "NO";
  } else {
    return finalPrice < round.targetPrice ? "YES" : "NO";
  }
}

// Calculate Kalshi market efficiency
export function calculateKalshiEfficiency(
  rounds: KalshiRound[],
  actualOutcomes: ("YES" | "NO")[]
): {
  efficiency: number;      // 0-100, how accurate market prices were
  avgEdge: number;         // Average edge available
  winRate: number;         // Win rate of following edge
} {
  if (rounds.length !== actualOutcomes.length || rounds.length === 0) {
    return { efficiency: 50, avgEdge: 0, winRate: 50 };
  }
  
  let correctPredictions = 0;
  let totalEdge = 0;
  let edgeWins = 0;
  let edgeCount = 0;
  
  rounds.forEach((round, i) => {
    const outcome = actualOutcomes[i];
    const marketProb = round.yesPrice * 100;
    
    // Check if market prediction was correct
    const marketPrediction = marketProb > 50 ? "YES" : "NO";
    if (marketPrediction === outcome) correctPredictions++;
    
    // Calculate edge
    const actualProb = outcome === "YES" ? 100 : 0;
    const edge = Math.abs(actualProb - marketProb);
    totalEdge += edge;
    
    // Track edge following performance
    if (edge > 10) {
      edgeCount++;
      const edgeDirection = actualProb > marketProb ? "YES" : "NO";
      if (edgeDirection === outcome) edgeWins++;
    }
  });
  
  const efficiency = (correctPredictions / rounds.length) * 100;
  const avgEdge = totalEdge / rounds.length;
  const winRate = edgeCount > 0 ? (edgeWins / edgeCount) * 100 : 50;
  
  return {
    efficiency: Math.round(efficiency),
    avgEdge: Math.round(avgEdge * 10) / 10,
    winRate: Math.round(winRate)
  };
}

