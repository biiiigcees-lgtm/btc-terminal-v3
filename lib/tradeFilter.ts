// lib/tradeFilter.ts — Trade Filter Engine with EV and volatility gates

import type { Indicators, Candle, MarketData } from "@/types";
import { AlphaScoreResult } from "./alphaEngine";
import { KalshiSignal, KalshiProbability } from "./kalshiEngine";
import { ConsensusResult } from "./consensusEngine";
import { TradeCandidate, EVAnalysis } from "./evEngine";

export interface FilterCriteria {
  evThreshold: number;           // Minimum EV to consider (default: 0.01)
  minProbability: number;        // Minimum win probability (default: 55%)
  maxVolatility: number;          // Maximum volatility allowed (default: 5%)
  minConfidence: number;          // Minimum confidence score (default: 60)
  maxDrawdown: number;            // Maximum allowed drawdown (default: 10%)
  minRiskReward: number;          // Minimum risk/reward ratio (default: 1.2)
  maxTimeHorizon: number;         // Maximum time horizon in minutes (default: 120)
  minAgreement: number;           // Minimum agent agreement (default: 60%)
  maxDissent: number;             // Maximum dissent level (default: 40%)
}

export interface FilterResult {
  shouldTrade: boolean;
  decision: "TRADE" | "NO_TRADE" | "HOLD";
  confidence: number;             // 0-100
  reasons: string[];              // Why this decision was made
  blockedBy: string[];            // Which filters blocked the trade
  warnings: string[];             // Concerns that don't block the trade
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  recommendation: string;
  alternativeActions: string[];
}

export interface RiskMetrics {
  currentDrawdown: number;
  maxDrawdown: number;
  consecutiveLosses: number;
  dailyLossLimit: number;
  weeklyLossLimit: number;
  volatilityRegime: "NORMAL" | "ELEVATED" | "EXTREME";
  marketCondition: "FAVORABLE" | "NEUTRAL" | "ADVERSE";
}

export interface SessionState {
  isLocked: boolean;
  lockReason: string | null;
  lockUntil: number | null;
  consecutiveLosses: number;
  currentDrawdown: number;
  dailyPnL: number;
  weeklyPnL: number;
  totalTrades: number;
  lastTradeTime: number;
  cooldownPeriod: number;        // minutes
}

// Default filter criteria - ABSOLUTE SILENCE RULE (Final God Tier Lock)
const DEFAULT_FILTERS: FilterCriteria = {
  evThreshold: 0.06,           // EV must be > 0.06 (absolute threshold)
  minProbability: 60,          // Probability must be >= 60% (absolute threshold)
  maxVolatility: 5.0,
  minConfidence: 60,
  maxDrawdown: 10.0,
  minRiskReward: 1.2,
  maxTimeHorizon: 120,
  minAgreement: 65,            // Consensus agreement > 65% (absolute threshold)
  maxDissent: 20               // Lower dissent allowed (stricter)
};

// ABSOLUTE SILENCE RULE - Final God Tier Lock filtering (absolute thresholds)
export function applyHardNoTradeRule(
  evAnalysis: EVAnalysis,
  consensus: ConsensusResult,
  alpha: AlphaScoreResult,
  kalshiFeasibility?: { feasible: boolean; score: number } // Kalshi feasibility check
): {
  shouldTrade: boolean;
  reason: string;
  blockingRule: string;
  details: string[];
} {
  const blockingReasons: string[] = [];
  
  // Rule 1: EV must be > 0.06 (absolute threshold)
  if (evAnalysis.ev.ev <= 0.06) {
    blockingReasons.push(`EV too low: ${evAnalysis.ev.ev.toFixed(3)} ≤ 0.06`);
  }
  
  // Rule 2: Probability must be >= 60% (absolute threshold)
  if (evAnalysis.candidate.probability < 60) {
    blockingReasons.push(`Probability too low: ${evAnalysis.candidate.probability}% < 60%`);
  }
  
  // Rule 3: Consensus agreement must be > 65% (absolute threshold)
  if (consensus.agreement <= 65) {
    blockingReasons.push(`Consensus too low: ${consensus.agreement}% ≤ 65%`);
  }
  
  // Rule 4: Dissent must be <= 20% (stricter)
  if (consensus.dissentLevel > 20) {
    blockingReasons.push(`Dissent too high: ${consensus.dissentLevel}% > 20%`);
  }
  
  // Rule 5: Kalshi feasibility must be valid (new absolute requirement)
  if (kalshiFeasibility && !kalshiFeasibility.feasible) {
    blockingReasons.push(`Kalshi target not feasible: ${kalshiFeasibility.score}/100`);
  }
  
  // Rule 6: Check for conflicting signals (stricter)
  const conflictingSignals = detectConflictingSignals(consensus, alpha);
  if (conflictingSignals.length > 0) {
    blockingReasons.push(`Conflicting signals: ${conflictingSignals.join(", ")}`);
  }
  
  // If ANY rule fails, return NO TRADE
  if (blockingReasons.length > 0) {
    return {
      shouldTrade: false,
      reason: "NO EDGE",
      blockingRule: "ABSOLUTE_SILENCE",
      details: blockingReasons
    };
  }
  
  // All absolute rules passed - allow trade
  return {
    shouldTrade: true,
    reason: "VALID TRADE",
    blockingRule: "NONE",
    details: ["All absolute thresholds met"]
  };
}

// Detect conflicting signals between engines
function detectConflictingSignals(
  consensus: ConsensusResult,
  alpha: AlphaScoreResult
): string[] {
  const conflicts: string[] = [];
  
  // Alpha vs Consensus direction conflict
  if (alpha.direction !== "WAIT" && consensus.direction !== "NEUTRAL") {
    if (alpha.direction !== consensus.direction) {
      conflicts.push("Alpha vs Consensus direction mismatch");
    }
  }
  
  // Low consensus agreement
  if (consensus.agreement < 50) {
    conflicts.push("Low agent agreement");
  }
  
  // Weak consensus strength
  if (consensus.strength < 40) {
    conflicts.push("Weak consensus signal");
  }
  
  // High dissent level
  if (consensus.dissentLevel > 60) {
    conflicts.push("High agent dissent");
  }
  
  // Alpha confidence vs consensus confidence mismatch
  if (Math.abs(alpha.confidence - consensus.confidence) > 30) {
    conflicts.push("Confidence level mismatch");
  }
  
  return conflicts;
}

// Calculate risk metrics
export function calculateRiskMetrics(
  indicators: Indicators,
  market: MarketData,
  session: SessionState
): RiskMetrics {
  const currentPrice = market.price;
  const atrPercent = (indicators.atr / currentPrice) * 100;
  
  // Determine volatility regime
  let volatilityRegime: RiskMetrics["volatilityRegime"] = "NORMAL";
  if (atrPercent > 3) volatilityRegime = "EXTREME";
  else if (atrPercent > 1.5) volatilityRegime = "ELEVATED";
  
  // Determine market condition
  let marketCondition: RiskMetrics["marketCondition"] = "NEUTRAL";
  const rsi = indicators.rsi;
  const bbPos = (currentPrice - indicators.bbLower) / (indicators.bbUpper - indicators.bbLower);
  
  if (rsi > 30 && rsi < 70 && bbPos > 0.2 && bbPos < 0.8) {
    marketCondition = "FAVORABLE";
  } else if (rsi > 80 || rsi < 20 || bbPos > 0.9 || bbPos < 0.1) {
    marketCondition = "ADVERSE";
  }
  
  return {
    currentDrawdown: session.currentDrawdown,
    maxDrawdown: session.currentDrawdown, // Would track historical max
    consecutiveLosses: session.consecutiveLosses,
    dailyLossLimit: Math.max(0, -session.dailyPnL),
    weeklyLossLimit: Math.max(0, -session.weeklyPnL),
    volatilityRegime,
    marketCondition
  };
}

// EV Filter - Check if expected value meets threshold
function checkEVFilter(evAnalysis: EVAnalysis, criteria: FilterCriteria): {
  passed: boolean;
  reason: string;
} {
  if (evAnalysis.ev.ev < criteria.evThreshold) {
    return {
      passed: false,
      reason: `EV ${evAnalysis.ev.ev} below threshold ${criteria.evThreshold}`
    };
  }
  
  if (evAnalysis.ev.riskAdjustedEV < criteria.evThreshold * 0.5) {
    return {
      passed: false,
      reason: `Risk-adjusted EV ${evAnalysis.ev.riskAdjustedEV} too low`
    };
  }
  
  return { passed: true, reason: `EV ${evAnalysis.ev.ev} acceptable` };
}

// Probability Filter - Check win probability
function checkProbabilityFilter(evAnalysis: EVAnalysis, criteria: FilterCriteria): {
  passed: boolean;
  reason: string;
} {
  const probability = evAnalysis.candidate.probability;
  
  if (probability < criteria.minProbability) {
    return {
      passed: false,
      reason: `Probability ${probability}% below minimum ${criteria.minProbability}%`
    };
  }
  
  return { passed: true, reason: `Probability ${probability}% acceptable` };
}

// Volatility Filter - Check if volatility is acceptable
function checkVolatilityFilter(
  indicators: Indicators,
  market: MarketData,
  criteria: FilterCriteria
): {
  passed: boolean;
  reason: string;
  warning?: string;
} {
  const atrPercent = (indicators.atr / market.price) * 100;
  
  if (atrPercent > criteria.maxVolatility) {
    return {
      passed: false,
      reason: `Volatility ${atrPercent.toFixed(1)}% exceeds maximum ${criteria.maxVolatility}%`
    };
  }
  
  let warning: string | undefined;
  if (atrPercent > criteria.maxVolatility * 0.7) {
    warning = `High volatility ${atrPercent.toFixed(1)}% - exercise caution`;
  }
  
  return { passed: true, reason: `Volatility ${atrPercent.toFixed(1)}% acceptable`, warning };
}

// Confidence Filter - Check overall confidence
function checkConfidenceFilter(
  alpha: AlphaScoreResult,
  consensus: ConsensusResult,
  criteria: FilterCriteria
): {
  passed: boolean;
  reason: string;
} {
  const avgConfidence = (alpha.confidence + consensus.confidence) / 2;
  
  if (avgConfidence < criteria.minConfidence) {
    return {
      passed: false,
      reason: `Average confidence ${avgConfidence.toFixed(0)}% below minimum ${criteria.minConfidence}%`
    };
  }
  
  return { passed: true, reason: `Confidence ${avgConfidence.toFixed(0)}% acceptable` };
}

// Risk/Reward Filter - Check risk/reward ratio
function checkRiskRewardFilter(evAnalysis: EVAnalysis, criteria: FilterCriteria): {
  passed: boolean;
  reason: string;
} {
  if (evAnalysis.ev.riskReward < criteria.minRiskReward) {
    return {
      passed: false,
      reason: `Risk/reward ${evAnalysis.ev.riskReward.toFixed(2)} below minimum ${criteria.minRiskReward}`
    };
  }
  
  return { passed: true, reason: `Risk/reward ${evAnalysis.ev.riskReward.toFixed(2)} acceptable` };
}

// Time Horizon Filter - Check if time horizon is acceptable
function checkTimeHorizonFilter(evAnalysis: EVAnalysis, criteria: FilterCriteria): {
  passed: boolean;
  reason: string;
} {
  if (evAnalysis.candidate.timeHorizon > criteria.maxTimeHorizon) {
    return {
      passed: false,
      reason: `Time horizon ${evAnalysis.candidate.timeHorizon}min exceeds maximum ${criteria.maxTimeHorizon}min`
    };
  }
  
  return { passed: true, reason: `Time horizon ${evAnalysis.candidate.timeHorizon}min acceptable` };
}

// Consensus Filter - Check agent agreement
function checkConsensusFilter(consensus: ConsensusResult, criteria: FilterCriteria): {
  passed: boolean;
  reason: string;
  warning?: string;
} {
  if (consensus.agreement < criteria.minAgreement) {
    return {
      passed: false,
      reason: `Agent agreement ${consensus.agreement.toFixed(0)}% below minimum ${criteria.minAgreement}%`
    };
  }
  
  if (consensus.dissentLevel > criteria.maxDissent) {
    return {
      passed: false,
      reason: `Dissent level ${consensus.dissentLevel.toFixed(0)}% exceeds maximum ${criteria.maxDissent}%`
    };
  }
  
  let warning: string | undefined;
  if (consensus.strength < 50) {
    warning = `Weak consensus strength ${consensus.strength.toFixed(0)}%`;
  }
  
  return { passed: true, reason: `Consensus acceptable`, warning };
}

// Session Risk Filter - Check session-level risk limits
function checkSessionRiskFilter(
  session: SessionState,
  riskMetrics: RiskMetrics,
  criteria: FilterCriteria
): {
  passed: boolean;
  reason: string;
  blocked: boolean;
} {
  // Check if session is locked
  if (session.isLocked) {
    return {
      passed: false,
      reason: session.lockReason || "Session locked",
      blocked: true
    };
  }
  
  // Check consecutive losses
  if (session.consecutiveLosses >= 3) {
    return {
      passed: false,
      reason: `${session.consecutiveLosses} consecutive losses - cooling off`,
      blocked: true
    };
  }
  
  // Check daily loss limit
  if (session.dailyPnL < -10) { // 10% daily loss limit
    return {
      passed: false,
      reason: `Daily loss ${Math.abs(session.dailyPnL).toFixed(1)}% exceeds limit`,
      blocked: true
    };
  }
  
  // Check current drawdown
  if (session.currentDrawdown > criteria.maxDrawdown) {
    return {
      passed: false,
      reason: `Drawdown ${session.currentDrawdown.toFixed(1)}% exceeds maximum ${criteria.maxDrawdown}%`,
      blocked: false
    };
  }
  
  // Check cooldown period
  const timeSinceLastTrade = (Date.now() - session.lastTradeTime) / (1000 * 60);
  if (timeSinceLastTrade < session.cooldownPeriod) {
    return {
      passed: false,
      reason: `Cooldown period ${session.cooldownPeriod - timeSinceLastTrade.toFixed(0)}min remaining`,
      blocked: false
    };
  }
  
  return { passed: true, reason: "Session risk acceptable", blocked: false };
}

// Market Condition Filter - Check overall market conditions
function checkMarketConditionFilter(
  riskMetrics: RiskMetrics,
  market: MarketData,
  criteria: FilterCriteria
): {
  passed: boolean;
  reason: string;
  warning?: string;
} {
  // Block trades in extreme volatility
  if (riskMetrics.volatilityRegime === "EXTREME") {
    return {
      passed: false,
      reason: "Extreme volatility - all trades blocked"
    };
  }
  
  // Extra caution in adverse market conditions
  if (riskMetrics.marketCondition === "ADVERSE") {
    return {
      passed: false,
      reason: "Adverse market conditions - trades blocked"
    };
  }
  
  let warning: string | undefined;
  if (riskMetrics.volatilityRegime === "ELEVATED") {
    warning = "Elevated volatility - reduced position sizes recommended";
  }
  
  return { passed: true, reason: "Market conditions acceptable", warning };
}

// Main filter function with HARD NO TRADE RULE
export function filterTrade(
  evAnalysis: EVAnalysis,
  alpha: AlphaScoreResult,
  consensus: ConsensusResult,
  indicators: Indicators,
  market: MarketData,
  session: SessionState,
  customCriteria?: Partial<FilterCriteria>
): FilterResult {
  const criteria = { ...DEFAULT_FILTERS, ...customCriteria };
  const riskMetrics = calculateRiskMetrics(indicators, market, session);
  
  // Apply HARD NO TRADE RULE first
  const hardRuleCheck = applyHardNoTradeRule(evAnalysis, consensus, alpha);
  
  if (!hardRuleCheck.shouldTrade) {
    return {
      shouldTrade: false,
      decision: "NO_TRADE",
      confidence: 95, // High confidence in no-trade decision
      reasons: ["No Edge — Do Not Trade"],
      blockedBy: [hardRuleCheck.reason],
      warnings: [],
      riskLevel: "LOW",
      recommendation: "No Edge — Do Not Trade",
      alternativeActions: ["Wait for better opportunity", "Check signal alignment", "Monitor market conditions"]
    };
  }
  
  // Continue with additional filters only if hard rules pass
  const blockedBy: string[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [hardRuleCheck.reason];
  
  // Run remaining filters
  const volCheck = checkVolatilityFilter(indicators, market, criteria);
  if (!volCheck.passed) blockedBy.push(volCheck.reason);
  else {
    reasons.push(volCheck.reason);
    if (volCheck.warning) warnings.push(volCheck.warning);
  }
  
  const confCheck = checkConfidenceFilter(alpha, consensus, criteria);
  if (!confCheck.passed) blockedBy.push(confCheck.reason);
  else reasons.push(confCheck.reason);
  
  const rrCheck = checkRiskRewardFilter(evAnalysis, criteria);
  if (!rrCheck.passed) blockedBy.push(rrCheck.reason);
  else reasons.push(rrCheck.reason);
  
  const timeCheck = checkTimeHorizonFilter(evAnalysis, criteria);
  if (!timeCheck.passed) blockedBy.push(timeCheck.reason);
  else reasons.push(timeCheck.reason);
  
  const consensusCheck = checkConsensusFilter(consensus, criteria);
  if (!consensusCheck.passed) blockedBy.push(consensusCheck.reason);
  else {
    reasons.push(consensusCheck.reason);
    if (consensusCheck.warning) warnings.push(consensusCheck.warning);
  }
  
  const sessionCheck = checkSessionRiskFilter(session, riskMetrics, criteria);
  if (!sessionCheck.passed) {
    if (sessionCheck.blocked) {
      blockedBy.unshift(sessionCheck.reason);
    } else {
      blockedBy.push(sessionCheck.reason);
    }
  } else {
    reasons.push(sessionCheck.reason);
  }
  
  const marketCheck = checkMarketConditionFilter(riskMetrics, market, criteria);
  if (!marketCheck.passed) blockedBy.push(marketCheck.reason);
  else {
    reasons.push(marketCheck.reason);
    if (marketCheck.warning) warnings.push(marketCheck.warning);
  }
  
  // Determine final decision
  const shouldTrade = blockedBy.length === 0;
  let decision: FilterResult["decision"] = "NO_TRADE";
  let confidence = 0;
  
  if (shouldTrade) {
    decision = "TRADE";
    // Calculate confidence based on how many filters passed strongly
    const strongPasses = reasons.filter(r => r.includes("acceptable") || r.includes("good")).length;
    confidence = Math.min(100, (strongPasses / reasons.length) * 100);
  } else if (blockedBy.some(b => b.includes("cooling") || b.includes("locked"))) {
    decision = "HOLD";
    confidence = 80;
  }
  
  // Determine risk level
  let riskLevel: FilterResult["riskLevel"] = "LOW";
  if (riskMetrics.volatilityRegime === "ELEVATED" || riskMetrics.currentDrawdown > 5) {
    riskLevel = "MEDIUM";
  }
  if (riskMetrics.volatilityRegime === "EXTREME" || riskMetrics.currentDrawdown > 8) {
    riskLevel = "HIGH";
  }
  if (session.consecutiveLosses >= 2 || riskMetrics.currentDrawdown > 10) {
    riskLevel = "EXTREME";
  }
  
  // Generate recommendation
  let recommendation = "";
  const alternativeActions: string[] = [];
  
  if (shouldTrade) {
    recommendation = `Proceed with ${evAnalysis.candidate.direction} trade`;
    if (warnings.length > 0) {
      recommendation += ` (caution: ${warnings[0]})`;
    }
  } else {
    recommendation = blockedBy[0] || "Trade blocked by filters";
    
    if (blockedBy.some(b => b.includes("volatility"))) {
      alternativeActions.push("Wait for volatility to normalize");
    }
    if (blockedBy.some(b => b.includes("confidence"))) {
      alternativeActions.push("Wait for stronger signal consensus");
    }
    if (blockedBy.some(b => b.includes("locked") || b.includes("cooling"))) {
      alternativeActions.push("Wait for session lock to expire");
    }
  }
  
  return {
    shouldTrade,
    decision,
    confidence,
    reasons,
    blockedBy,
    warnings,
    riskLevel,
    recommendation,
    alternativeActions
  };
}

// Quick filter for initial screening (less strict)
export function quickFilter(
  ev: number,
  probability: number,
  confidence: number,
  volatility: number
): boolean {
  return ev > 0.005 && 
         probability > 50 && 
         confidence > 50 && 
         volatility < 8;
}
