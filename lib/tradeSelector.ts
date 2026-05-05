// lib/tradeSelector.ts — Best Trade Selector for highest EV trades

import type { Indicators, Candle, MarketData } from "@/types";
import { AlphaScoreResult } from "./alphaEngine";
import { KalshiSignal, KalshiRound, createKalshiCandidate } from "./kalshiEngine";
import { ConsensusResult } from "./consensusEngine";
import { TradeCandidate, EVAnalysis, selectBestTrade, createAlphaCandidate } from "./evEngine";
import { FilterResult, filterTrade, SessionState } from "./tradeFilter";

export interface TradeOpportunity {
  id: string;
  type: "KALSHI" | "SPOT";
  source: string;
  direction: "ABOVE" | "BELOW";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  probability: number;
  confidence: number;
  timeHorizon: number;
  ev: number;
  riskAdjustedEV: number;
  riskReward: number;
  kellyFraction: number;
  positionSize: number;
  maxDrawdown: number;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  quality: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  filterResult: FilterResult;
  evAnalysis: EVAnalysis;
}

export interface SelectionCriteria {
  minEV: number;
  minProbability: number;
  minConfidence: number;
  maxRisk: number;
  maxTimeHorizon: number;
  preferKalshi: boolean;
  riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
  maxPositions: number;
}

export interface SelectionResult {
  bestTrade: TradeOpportunity | null;
  alternatives: TradeOpportunity[];
  rejected: TradeOpportunity[];
  summary: {
    totalCandidates: number;
    viableTrades: number;
    averageEV: number;
    bestEV: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    recommendation: string;
  };
  marketContext: {
    volatility: "LOW" | "MEDIUM" | "HIGH";
    trend: "BULLISH" | "BEARISH" | "NEUTRAL";
    liquidity: "GOOD" | "FAIR" | "POOR";
    sentiment: "OPTIMISTIC" | "NEUTRAL" | "PESSIMISTIC";
  };
}

// Default selection criteria
const DEFAULT_CRITERIA: SelectionCriteria = {
  minEV: 0.02,
  minProbability: 60,
  minConfidence: 65,
  maxRisk: 5,
  maxTimeHorizon: 90,
  preferKalshi: true,
  riskTolerance: "MODERATE",
  maxPositions: 1
};

// Calculate trade urgency
function calculateUrgency(
  timeHorizon: number,
  volatility: number,
  ev: number
): TradeOpportunity["urgency"] {
  let urgencyScore = 0;
  
  // Time pressure
  if (timeHorizon < 5) urgencyScore += 3;
  else if (timeHorizon < 15) urgencyScore += 2;
  else if (timeHorizon < 30) urgencyScore += 1;
  
  // EV pressure
  if (ev > 0.05) urgencyScore += 2;
  else if (ev > 0.03) urgencyScore += 1;
  
  // Volatility pressure
  if (volatility > 3) urgencyScore += 1;
  
  if (urgencyScore >= 5) return "EXTREME";
  if (urgencyScore >= 3) return "HIGH";
  if (urgencyScore >= 1) return "MEDIUM";
  return "LOW";
}

// Calculate trade quality
function calculateQuality(
  ev: number,
  riskAdjustedEV: number,
  probability: number,
  confidence: number,
  riskReward: number
): TradeOpportunity["quality"] {
  let qualityScore = 0;
  
  // EV quality
  if (ev > 0.08) qualityScore += 3;
  else if (ev > 0.04) qualityScore += 2;
  else if (ev > 0.02) qualityScore += 1;
  
  // Risk-adjusted EV quality
  if (riskAdjustedEV > 0.04) qualityScore += 2;
  else if (riskAdjustedEV > 0.02) qualityScore += 1;
  
  // Probability quality
  if (probability > 75) qualityScore += 2;
  else if (probability > 65) qualityScore += 1;
  
  // Confidence quality
  if (confidence > 80) qualityScore += 2;
  else if (confidence > 70) qualityScore += 1;
  
  // Risk/reward quality
  if (riskReward > 2) qualityScore += 1;
  
  if (qualityScore >= 8) return "EXCELLENT";
  if (qualityScore >= 5) return "GOOD";
  if (qualityScore >= 3) return "FAIR";
  return "POOR";
}

// Generate trade opportunities from multiple sources
function generateOpportunities(
  alpha: AlphaScoreResult,
  kalshiSignals: KalshiSignal[],
  indicators: Indicators,
  market: MarketData,
  session: SessionState,
  criteria: SelectionCriteria
): TradeOpportunity[] {
  const opportunities: TradeOpportunity[] = [];
  
  // Generate Kalshi opportunities
  kalshiSignals.forEach((kalshi, index) => {
    try {
      const candidate = createKalshiCandidate(kalshi, market.price);
      const evAnalysis = analyzeEV(candidate, market, indicators, session);
      const filterResult = filterTrade(evAnalysis, alpha, null, indicators, market, session);
      
      const opportunity: TradeOpportunity = {
        id: `kalshi_${index}`,
        type: "KALSHI",
        source: kalshi.round.ticker,
        direction: candidate.direction,
        entryPrice: candidate.entryPrice,
        targetPrice: candidate.targetPrice,
        stopLoss: candidate.stopLoss,
        probability: candidate.probability,
        confidence: candidate.confidence,
        timeHorizon: candidate.timeHorizon,
        ev: evAnalysis.ev.ev,
        riskAdjustedEV: evAnalysis.ev.riskAdjustedEV,
        riskReward: evAnalysis.ev.riskReward,
        kellyFraction: evAnalysis.ev.kellyFraction,
        positionSize: evAnalysis.ev.positionSize,
        maxDrawdown: evAnalysis.ev.maxDrawdown,
        urgency: calculateUrgency(candidate.timeHorizon, (indicators.atr / market.price) * 100, evAnalysis.ev.ev),
        quality: calculateQuality(evAnalysis.ev.ev, evAnalysis.ev.riskAdjustedEV, candidate.probability, candidate.confidence, evAnalysis.ev.riskReward),
        filterResult,
        evAnalysis
      };
      
      opportunities.push(opportunity);
    } catch (error) {
      // Skip invalid candidates
    }
  });
  
  // Generate Alpha/Spot opportunity
  if (alpha.direction !== "WAIT") {
    try {
      const candidate = createAlphaCandidate(alpha, market.price, indicators);
      const evAnalysis = analyzeEV(candidate, market, indicators, session);
      const filterResult = filterTrade(evAnalysis, alpha, null, indicators, market, session);
      
      const opportunity: TradeOpportunity = {
        id: "alpha_spot",
        type: "SPOT",
        source: "alpha-engine",
        direction: candidate.direction,
        entryPrice: candidate.entryPrice,
        targetPrice: candidate.targetPrice,
        stopLoss: candidate.stopLoss,
        probability: candidate.probability,
        confidence: candidate.confidence,
        timeHorizon: candidate.timeHorizon,
        ev: evAnalysis.ev.ev,
        riskAdjustedEV: evAnalysis.ev.riskAdjustedEV,
        riskReward: evAnalysis.ev.riskReward,
        kellyFraction: evAnalysis.ev.kellyFraction,
        positionSize: evAnalysis.ev.positionSize,
        maxDrawdown: evAnalysis.ev.maxDrawdown,
        urgency: calculateUrgency(candidate.timeHorizon, (indicators.atr / market.price) * 100, evAnalysis.ev.ev),
        quality: calculateQuality(evAnalysis.ev.ev, evAnalysis.ev.riskAdjustedEV, candidate.probability, candidate.confidence, evAnalysis.ev.riskReward),
        filterResult,
        evAnalysis
      };
      
      opportunities.push(opportunity);
    } catch (error) {
      // Skip invalid candidates
    }
  }
  
  return opportunities;
}

// Analyze EV for a candidate (simplified version)
function analyzeEV(
  candidate: TradeCandidate,
  market: MarketData,
  indicators: Indicators,
  session: SessionState
): EVAnalysis {
  const volatility = (indicators.atr / market.price) * 100;
  
  return {
    candidate,
    ev: {
      ev: candidate.probability > 50 ? 
        (candidate.probability / 100) * candidate.reward - ((100 - candidate.probability) / 100) * candidate.risk :
        -((100 - candidate.probability) / 100) * candidate.risk + (candidate.probability / 100) * candidate.reward,
      riskAdjustedEV: candidate.probability > 50 ? 
        ((candidate.probability / 100) * candidate.reward - ((100 - candidate.probability) / 100) * candidate.risk) * (1 - volatility * 0.1) :
        -(((100 - candidate.probability) / 100) * candidate.risk - (candidate.probability / 100) * candidate.reward) * (1 - volatility * 0.1),
      kellyFraction: Math.max(0, ((candidate.reward / candidate.risk) * (candidate.probability / 100) - (100 - candidate.probability) / 100) / (candidate.reward / candidate.risk)),
      positionSize: Math.min(5, session.bankroll * 0.1),
      riskReward: candidate.reward / candidate.risk,
      sharpeRatio: 0,
      maxDrawdown: candidate.risk * 2,
      confidence: candidate.confidence,
      shouldTrade: true,
      reasons: ["Candidate analyzed"]
    },
    alternatives: [],
    marketContext: {
      volatility,
      trend: candidate.direction === "ABOVE" ? "BULL" : "BEAR",
      liquidity: "HIGH",
      timePressure: candidate.timeHorizon < 15
    }
  };
}

// Filter opportunities based on criteria
function filterOpportunities(
  opportunities: TradeOpportunity[],
  criteria: SelectionCriteria
): {
  viable: TradeOpportunity[];
  rejected: TradeOpportunity[];
} {
  const viable: TradeOpportunity[] = [];
  const rejected: TradeOpportunity[] = [];
  
  opportunities.forEach(opp => {
    let passes = true;
    
    // Basic filters
    if (opp.ev < criteria.minEV) passes = false;
    if (opp.probability < criteria.minProbability) passes = false;
    if (opp.confidence < criteria.minConfidence) passes = false;
    if (opp.maxDrawdown > criteria.maxRisk) passes = false;
    if (opp.timeHorizon > criteria.maxTimeHorizon) passes = false;
    
    // Filter result check
    if (!opp.filterResult.shouldTrade) passes = false;
    
    // Risk tolerance filter
    if (criteria.riskTolerance === "CONSERVATIVE" && (opp.quality === "FAIR" || opp.quality === "POOR")) passes = false;
    if (criteria.riskTolerance === "AGGRESSIVE" && opp.ev < 0.03) passes = false;
    
    // Preference filter
    if (criteria.preferKalshi && opp.type === "SPOT" && viable.some(o => o.type === "KALSHI" && o.quality !== "POOR")) {
      passes = false; // Prefer Kalshi if available and not poor quality
    }
    
    if (passes) {
      viable.push(opp);
    } else {
      rejected.push(opp);
    }
  });
  
  return { viable, rejected };
}

// EV-FIRST: Select best trade by EV only - show TOP 1
function selectBestOpportunity(
  viable: TradeOpportunity[],
  criteria: SelectionCriteria
): TradeOpportunity | null {
  if (!viable.length) return null;
  
  // EV-FIRST: Sort ONLY by risk-adjusted EV
  const sorted = [...viable].sort((a, b) => b.riskAdjustedEV - a.riskAdjustedEV);
  
  // Return only the TOP 1 trade by EV
  return sorted[0];
}

// Assess market context
function assessMarketContext(
  indicators: Indicators,
  market: MarketData,
  opportunities: TradeOpportunity[]
): SelectionResult["marketContext"] {
  const volatility = (indicators.atr / market.price) * 100;
  
  // Volatility assessment
  let volLevel: SelectionResult["marketContext"]["volatility"] = "MEDIUM";
  if (volatility < 1) volLevel = "LOW";
  else if (volatility > 2.5) volLevel = "HIGH";
  
  // Trend assessment
  let trend: SelectionResult["marketContext"]["trend"] = "NEUTRAL";
  if (indicators.ema9 > indicators.ema21 && indicators.ema21 > indicators.ema50) trend = "BULLISH";
  else if (indicators.ema9 < indicators.ema21 && indicators.ema21 < indicators.ema50) trend = "BEARISH";
  
  // Liquidity assessment (simplified)
  const liquidity: SelectionResult["marketContext"]["liquidity"] = 
    volatility < 2 ? "GOOD" : volatility < 3.5 ? "FAIR" : "POOR";
  
  // Sentiment assessment
  const avgProbability = opportunities.length > 0 ? 
    opportunities.reduce((sum, o) => sum + o.probability, 0) / opportunities.length : 50;
  
  let sentiment: SelectionResult["marketContext"]["sentiment"] = "NEUTRAL";
  if (avgProbability > 65) sentiment = "OPTIMISTIC";
  else if (avgProbability < 45) sentiment = "PESSIMISTIC";
  
  return {
    volatility: volLevel,
    trend,
    liquidity,
    sentiment
  };
}

// EV-FIRST Main selection function - show only TOP 1 trade
export function selectBestTrade(
  alpha: AlphaScoreResult,
  consensus: ConsensusResult,
  kalshiSignals: KalshiSignal[],
  indicators: Indicators,
  market: MarketData,
  session: SessionState,
  customCriteria?: Partial<SelectionCriteria>
): SelectionResult {
  const criteria = { ...DEFAULT_CRITERIA, ...customCriteria };
  
  // Generate all opportunities
  const opportunities = generateOpportunities(alpha, kalshiSignals, indicators, market, session, criteria);
  
  // Filter opportunities
  const { viable, rejected } = filterOpportunities(opportunities, criteria);
  
  // EV-FIRST: Select best trade by EV only
  const bestTrade = selectBestOpportunity(viable, criteria);
  
  // EV-FIRST: Hide all alternatives - only show TOP 1
  const alternatives: TradeOpportunity[] = [];
  
  // Calculate summary statistics
  const totalCandidates = opportunities.length;
  const viableTrades = viable.length;
  const averageEV = viable.length > 0 ? 
    viable.reduce((sum, o) => sum + o.ev, 0) / viable.length : 0;
  const bestEV = bestTrade?.ev || 0;
  
  let riskLevel: SelectionResult["summary"]["riskLevel"] = "LOW";
  if (bestTrade?.maxDrawdown && bestTrade.maxDrawdown > 3) riskLevel = "MEDIUM";
  if (bestTrade?.maxDrawdown && bestTrade.maxDrawdown > 6) riskLevel = "HIGH";
  
  let recommendation = "No viable trades available";
  if (bestTrade) {
    recommendation = `BEST TRADE: ${bestTrade.direction} ${bestTrade.type.toLowerCase()} (EV: ${bestTrade.ev.toFixed(3)})`;
  } else if (viable.length === 0 && opportunities.length > 0) {
    recommendation = "No Edge - Do Not Trade";
  }
  
  // Assess market context
  const marketContext = assessMarketContext(indicators, market, opportunities);
  
  return {
    bestTrade,
    alternatives, // Empty - EV-FIRST hides alternatives
    rejected,
    summary: {
      totalCandidates,
      viableTrades,
      averageEV: Math.round(averageEV * 1000) / 1000,
      bestEV: Math.round(bestEV * 1000) / 1000,
      riskLevel,
      recommendation
    },
    marketContext
  };
}

// Quick trade check for immediate decisions
export function quickTradeCheck(
  ev: number,
  probability: number,
  confidence: number,
  timeHorizon: number
): {
  shouldTrade: boolean;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  quality: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
} {
  const shouldTrade = ev > 0.02 && probability > 60 && confidence > 65 && timeHorizon < 90;
  const urgency = calculateUrgency(timeHorizon, 2, ev);
  const quality = calculateQuality(ev, ev * 0.8, probability, confidence, 1.5);
  
  return { shouldTrade, urgency, quality };
}
