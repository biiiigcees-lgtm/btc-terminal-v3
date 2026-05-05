// lib/kalshiRealityEngine.ts — KALSHI REALITY ENFORCEMENT with strict feasibility rules

export interface KalshiRealityMetrics {
  distanceToTarget: number;
  timeRemaining: number;
  requiredMovePerMin: number;
  feasibilityScore: number;
  urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  isTargetUnrealistic: boolean;
  volatilityRequirement: number;
  timeDecayFactor: number;
  probabilityAdjustment: number;
  warning: string | null;
}

export interface KalshiRealityResult {
  feasible: boolean;
  score: number;
  metrics: KalshiRealityMetrics;
  recommendation: string;
  adjustedProbability: number;
  originalProbability: number;
  realityCheck: "VALID" | "UNREALISTIC" | "IMPOSSIBLE";
}

// Realistic volatility thresholds (based on Bitcoin's typical price movements)
const REALISTIC_VOLATILITY = {
  perMinute: 0.02,      // 2% per minute maximum realistic
  per5Minutes: 0.05,     // 5% per 5 minutes maximum
  per10Minutes: 0.08,    // 8% per 10 minutes maximum
  per30Minutes: 0.15,    // 15% per 30 minutes maximum
  perHour: 0.25          // 25% per hour maximum
};

// Calculate Kalshi reality metrics
export function calculateKalshiReality(
  currentPrice: number,
  targetPrice: number,
  timeRemaining: number, // in minutes
  currentVolatility: number = 0.01 // default 1% per minute
): KalshiRealityMetrics {
  // Calculate distance to target
  const distanceToTarget = Math.abs(targetPrice - currentPrice);
  const distancePercent = distanceToTarget / currentPrice;
  
  // Calculate required move per minute
  const requiredMovePerMin = timeRemaining > 0 ? distancePercent / (timeRemaining / 1) : Infinity;
  
  // Calculate feasibility score (0-100)
  let feasibilityScore = 100;
  
  // Factor 1: Required move vs realistic volatility
  const realisticMove = getRealisticMove(timeRemaining);
  if (requiredMovePerMin > realisticMove) {
    const excess = (requiredMovePerMin - realisticMove) / realisticMove;
    feasibilityScore -= Math.min(50, excess * 100); // Max 50 point penalty
  }
  
  // Factor 2: Time pressure
  if (timeRemaining < 2) feasibilityScore -= 40; // Extreme time pressure
  else if (timeRemaining < 5) feasibilityScore -= 25; // High time pressure
  else if (timeRemaining < 10) feasibilityScore -= 15; // Medium time pressure
  else if (timeRemaining < 30) feasibilityScore -= 5; // Low time pressure
  
  // Factor 3: Distance magnitude
  if (distancePercent > 0.03) feasibilityScore -= 30; // >3% move is difficult
  else if (distancePercent > 0.02) feasibilityScore -= 15; // >2% move is challenging
  else if (distancePercent > 0.01) feasibilityScore -= 5; // >1% move is moderate
  
  // Factor 4: Current volatility alignment
  const volatilityAlignment = Math.min(currentVolatility, requiredMovePerMin) / requiredMovePerMin;
  feasibilityScore *= volatilityAlignment; // Penalty if volatility too low
  
  feasibilityScore = Math.max(0, Math.min(100, feasibilityScore));
  
  // Determine urgency level
  let urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME" = "LOW";
  if (timeRemaining < 2 || requiredMovePerMin > realisticMove * 2) urgencyLevel = "EXTREME";
  else if (timeRemaining < 5 || requiredMovePerMin > realisticMove * 1.5) urgencyLevel = "HIGH";
  else if (timeRemaining < 15 || requiredMovePerMin > realisticMove) urgencyLevel = "MEDIUM";
  
  // Check if target is unrealistic
  const isTargetUnrealistic = requiredMovePerMin > realisticMove * 1.5 || 
                             distancePercent > 0.04 || 
                             (timeRemaining < 5 && requiredMovePerMin > 0.01);
  
  // Calculate volatility requirement
  const volatilityRequirement = requiredMovePerMin;
  
  // Calculate time decay factor (closer to expiration = more decay)
  const timeDecayFactor = Math.max(0, 1 - (timeRemaining / 120)); // 2 hour baseline
  
  // Calculate probability adjustment
  let probabilityAdjustment = 1.0;
  if (isTargetUnrealistic) {
    probabilityAdjustment = 0.3; // Cap at 30% for unrealistic targets
  } else if (feasibilityScore < 50) {
    probabilityAdjustment = 0.5; // Halve probability for low feasibility
  } else if (feasibilityScore < 70) {
    probabilityAdjustment = 0.75; // Reduce by 25% for medium feasibility
  }
  
  // Generate warning
  let warning: string | null = null;
  if (isTargetUnrealistic) {
    warning = "Target statistically unlikely given time and volatility constraints";
  } else if (requiredMovePerMin > realisticMove) {
    warning = "Target requires faster price movement than typical market conditions";
  } else if (timeRemaining < 5 && distancePercent > 0.01) {
    warning = "Limited time remaining for significant price movement";
  }
  
  return {
    distanceToTarget,
    timeRemaining,
    requiredMovePerMin,
    feasibilityScore,
    urgencyLevel,
    isTargetUnrealistic,
    volatilityRequirement,
    timeDecayFactor,
    probabilityAdjustment,
    warning
  };
}

// Get realistic move threshold based on time remaining
function getRealisticMove(timeRemaining: number): number {
  if (timeRemaining <= 1) return REALISTIC_VOLATILITY.perMinute;
  if (timeRemaining <= 5) return REALISTIC_VOLATILITY.per5Minutes / 5;
  if (timeRemaining <= 10) return REALISTIC_VOLATILITY.per10Minutes / 10;
  if (timeRemaining <= 30) return REALISTIC_VOLATILITY.per30Minutes / 30;
  return REALISTIC_VOLATILITY.perHour / 60; // Per minute rate
}

// Apply Kalshi reality enforcement
export function applyKalshiRealityEnforcement(
  originalProbability: number,
  realityMetrics: KalshiRealityMetrics
): KalshiRealityResult {
  const { feasibilityScore, isTargetUnrealistic, probabilityAdjustment, warning } = realityMetrics;
  
  // Calculate adjusted probability
  const adjustedProbability = originalProbability * probabilityAdjustment;
  
  // Determine reality check status
  let realityCheck: "VALID" | "UNREALISTIC" | "IMPOSSIBLE";
  if (feasibilityScore < 20 || requiredMovePerMin > getRealisticMove(timeRemaining) * 3) {
    realityCheck = "IMPOSSIBLE";
  } else if (isTargetUnrealistic || feasibilityScore < 50) {
    realityCheck = "UNREALISTIC";
  } else {
    realityCheck = "VALID";
  }
  
  // Determine feasibility
  const feasible = realityCheck === "VALID" && feasibilityScore >= 65;
  
  // Generate recommendation
  let recommendation: string;
  if (realityCheck === "IMPOSSIBLE") {
    recommendation = "REJECT - Target cannot be reached in remaining time";
  } else if (realityCheck === "UNREALISTIC") {
    recommendation = "AVOID - Target requires unrealistic price movement";
  } else if (feasibilityScore < 75) {
    recommendation = "CAUTION - Target achievable but challenging";
  } else {
    recommendation = "ACCEPT - Target is realistically achievable";
  }
  
  return {
    feasible,
    score: feasibilityScore,
    metrics: realityMetrics,
    recommendation,
    adjustedProbability: Math.round(adjustedProbability),
    originalProbability: Math.round(originalProbability),
    realityCheck
  };
}

// Batch process multiple Kalshi targets
export function batchKalshiRealityCheck(
  targets: Array<{
    currentPrice: number;
    targetPrice: number;
    timeRemaining: number;
    originalProbability: number;
  }>,
  currentVolatility: number = 0.01
): KalshiRealityResult[] {
  return targets.map(target => {
    const realityMetrics = calculateKalshiReality(
      target.currentPrice,
      target.targetPrice,
      target.timeRemaining,
      currentVolatility
    );
    
    return applyKalshiRealityEnforcement(
      target.originalProbability,
      realityMetrics
    );
  });
}

// Get best feasible Kalshi target
export function getBestFeasibleKalshiTarget(
  targets: Array<{
    currentPrice: number;
    targetPrice: number;
    timeRemaining: number;
    originalProbability: number;
  }>,
  currentVolatility: number = 0.01
): KalshiRealityResult | null {
  const results = batchKalshiRealityCheck(targets, currentVolatility);
  
  // Filter for feasible targets
  const feasibleResults = results.filter(r => r.feasible);
  
  if (feasibleResults.length === 0) return null;
  
  // Sort by adjusted probability (highest first)
  feasibleResults.sort((a, b) => b.adjustedProbability - a.adjustedProbability);
  
  return feasibleResults[0];
}

// Validate Kalshi market conditions
export function validateKalshiMarketConditions(
  currentVolatility: number,
  priceMovement: number,
  timeWindow: number
): {
  valid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check volatility
  const realisticVolatility = getRealisticMove(timeWindow);
  if (currentVolatility < realisticVolatility * 0.5) {
    issues.push("Current volatility too low for target movement");
    recommendations.push("Wait for increased volatility or closer target");
  }
  
  // Check price movement
  if (priceMovement > realisticVolatility * 2) {
    issues.push("Required price movement exceeds realistic expectations");
    recommendations.push("Consider targets closer to current price");
  }
  
  // Check time window
  if (timeWindow < 5) {
    issues.push("Very short time window increases execution risk");
    recommendations.push("Allow more time for price movement");
  }
  
  return {
    valid: issues.length === 0,
    issues,
    recommendations
  };
}
