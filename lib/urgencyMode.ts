// lib/urgencyMode.ts — URGENCY MODE: final 2 minutes with weighted Kalshi feasibility

export interface UrgencyMetrics {
  timeRemaining: number;         // Minutes until expiration
  urgencyLevel: "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME";
  timeDecayFactor: number;       // 0-1, higher = more decay
  kalshiWeight: number;          // Weight given to Kalshi signals
  longTermWeight: number;        // Weight given to long-term signals
  requiredMoveSpeed: number;    // Required price movement per minute
  feasibilityCritical: boolean; // Whether feasibility is critical
  urgencyMultiplier: number;     // Multiplier for confidence adjustments
}

export interface UrgencyAdjustment {
  adjustedKalshiWeight: number;
  adjustedLongTermWeight: number;
  confidenceMultiplier: number;
  evThresholdReduction: number;  // Reduce EV threshold in urgency
  probabilityBoost: number;      // Boost probability for feasible trades
  riskAdjustment: number;        // Risk adjustment factor
  warnings: string[];
  recommendations: string[];
  urgencyActive: boolean;
  urgencyReason: string;
}

// Urgency mode thresholds
const URGENCY_THRESHOLDS = {
  extremeTime: 2,              // 2 minutes = extreme urgency
  highTime: 5,                 // 5 minutes = high urgency
  elevatedTime: 10,            // 10 minutes = elevated urgency
  maxKalshiWeight: 0.6,        // Maximum 60% weight to Kalshi
  minLongTermWeight: 0.1,       // Minimum 10% weight to long-term
  maxConfidenceBoost: 1.3,     // Maximum 30% confidence boost
  maxEVReduction: 0.02,         // Maximum 0.02 EV threshold reduction
  maxProbabilityBoost: 10,      // Maximum 10% probability boost
  requiredMoveSpeedThreshold: 0.01 // 1% per minute threshold
};

// Calculate urgency metrics
export function calculateUrgencyMetrics(
  timeRemaining: number,        // Minutes until expiration
  requiredMovePerMin: number,   // Required price movement per minute
  kalshiFeasibility: number     // 0-1 Kalshi feasibility score
): UrgencyMetrics {
  let urgencyLevel: "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME" = "NORMAL";
  let timeDecayFactor = 0;
  let kalshiWeight = 0.2;       // Default 20% Kalshi weight
  let longTermWeight = 0.5;     // Default 50% long-term weight
  let feasibilityCritical = false;
  let urgencyMultiplier = 1.0;

  // Determine urgency level based on time remaining
  if (timeRemaining <= URGENCY_THRESHOLDS.extremeTime) {
    urgencyLevel = "EXTREME";
    timeDecayFactor = 0.8;
    kalshiWeight = URGENCY_THRESHOLDS.maxKalshiWeight;
    longTermWeight = URGENCY_THRESHOLDS.minLongTermWeight;
    feasibilityCritical = true;
    urgencyMultiplier = 1.3;
  } else if (timeRemaining <= URGENCY_THRESHOLDS.highTime) {
    urgencyLevel = "HIGH";
    timeDecayFactor = 0.6;
    kalshiWeight = 0.5;
    longTermWeight = 0.2;
    feasibilityCritical = true;
    urgencyMultiplier = 1.2;
  } else if (timeRemaining <= URGENCY_THRESHOLDS.elevatedTime) {
    urgencyLevel = "ELEVATED";
    timeDecayFactor = 0.4;
    kalshiWeight = 0.35;
    longTermWeight = 0.35;
    feasibilityCritical = kalshiFeasibility < 0.6;
    urgencyMultiplier = 1.1;
  } else {
    timeDecayFactor = 0.1;
    feasibilityCritical = false;
  }

  // Adjust weights based on feasibility
  if (kalshiFeasibility > 0.8) {
    // High feasibility - increase Kalshi weight
    kalshiWeight = Math.min(URGENCY_THRESHOLDS.maxKalshiWeight, kalshiWeight + 0.1);
  } else if (kalshiFeasibility < 0.4 && feasibilityCritical) {
    // Low feasibility - reduce Kalshi weight
    kalshiWeight = Math.max(0.1, kalshiWeight - 0.2);
  }

  return {
    timeRemaining,
    urgencyLevel,
    timeDecayFactor,
    kalshiWeight,
    longTermWeight,
    requiredMoveSpeed: requiredMovePerMin,
    feasibilityCritical,
    urgencyMultiplier
  };
}

// Apply urgency mode adjustments
export function applyUrgencyMode(
  metrics: UrgencyMetrics,
  originalKalshiWeight: number = 0.2,
  originalLongTermWeight: number = 0.5,
  originalConfidence: number = 70,
  originalEVThreshold: number = 0.06,
  originalProbability: number = 60
): UrgencyAdjustment {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let urgencyActive = false;
  let urgencyReason = "";

  let adjustedKalshiWeight = originalKalshiWeight;
  let adjustedLongTermWeight = originalLongTermWeight;
  let confidenceMultiplier = 1.0;
  let evThresholdReduction = 0;
  let probabilityBoost = 0;
  let riskAdjustment = 1.0;

  // Apply adjustments based on urgency level
  switch (metrics.urgencyLevel) {
    case "EXTREME":
      urgencyActive = true;
      urgencyReason = "EXTREME urgency - final 2 minutes";
      
      // Dramatically shift weight to Kalshi feasibility
      adjustedKalshiWeight = metrics.kalshiWeight;
      adjustedLongTermWeight = metrics.longTermWeight;
      
      // Boost confidence for feasible trades
      confidenceMultiplier = URGENCY_THRESHOLDS.maxConfidenceBoost;
      
      // Reduce EV threshold to allow more trades
      evThresholdReduction = URGENCY_THRESHOLDS.maxEVReduction;
      
      // Boost probability for feasible targets
      probabilityBoost = metrics.feasibilityCritical ? URGENCY_THRESHOLDS.maxProbabilityBoost : 5;
      
      // Increase risk tolerance
      riskAdjustment = 1.5;
      
      warnings.push(`Only ${metrics.timeRemaining} minutes remaining`);
      warnings.push("Extreme urgency mode activated");
      if (metrics.requiredMoveSpeed > URGENCY_THRESHOLDS.requiredMoveSpeedThreshold) {
        warnings.push(`Very high required move speed: ${(metrics.requiredMoveSpeed * 100).toFixed(1)}%/min`);
      }
      
      recommendations.push("Focus exclusively on Kalshi feasibility");
      recommendations.push("Accept higher risk for time-critical opportunities");
      recommendations.push("Prioritize speed over perfect analysis");
      break;
      
    case "HIGH":
      urgencyActive = true;
      urgencyReason = "HIGH urgency - final 5 minutes";
      
      // Shift weight significantly to Kalshi
      adjustedKalshiWeight = metrics.kalshiWeight;
      adjustedLongTermWeight = metrics.longTermWeight;
      
      confidenceMultiplier = 1.2;
      evThresholdReduction = 0.015;
      probabilityBoost = metrics.feasibilityCritical ? 8 : 3;
      riskAdjustment = 1.3;
      
      warnings.push(`Only ${metrics.timeRemaining} minutes remaining`);
      warnings.push("High urgency mode activated");
      
      recommendations.push("Emphasize Kalshi feasibility in decisions");
      recommendations.push("Consider slightly lower quality setups");
      recommendations.push("Reduce analysis time");
      break;
      
    case "ELEVATED":
      urgencyActive = true;
      urgencyReason = "ELEVATED urgency - final 10 minutes";
      
      // Moderate shift to Kalshi
      adjustedKalshiWeight = metrics.kalshiWeight;
      adjustedLongTermWeight = metrics.longTermWeight;
      
      confidenceMultiplier = 1.1;
      evThresholdReduction = 0.01;
      probabilityBoost = metrics.feasibilityCritical ? 5 : 2;
      riskAdjustment = 1.15;
      
      warnings.push(`${metrics.timeRemaining} minutes remaining`);
      warnings.push("Elevated urgency mode active");
      
      recommendations.push("Increase consideration of Kalshi signals");
      recommendations.push("Be more selective but time-aware");
      break;
      
    case "NORMAL":
      urgencyActive = false;
      urgencyReason = "Normal trading conditions";
      break;
  }

  // Additional adjustments based on required move speed
  if (metrics.requiredMoveSpeed > URGENCY_THRESHOLDS.requiredMoveSpeedThreshold) {
    // High required move speed - increase urgency
    confidenceMultiplier *= 0.9; // Reduce confidence due to speed requirement
    probabilityBoost *= 0.8; // Reduce probability boost
    
    if (urgencyActive) {
      warnings.push(`Required move speed ${(metrics.requiredMoveSpeed * 100).toFixed(1)}%/min exceeds typical volatility`);
      recommendations.push("Verify if target is realistically achievable");
    }
  }

  // Cap adjustments
  confidenceMultiplier = Math.min(confidenceMultiplier, URGENCY_THRESHOLDS.maxConfidenceBoost);
  evThresholdReduction = Math.min(evThresholdReduction, URGENCY_THRESHOLDS.maxEVReduction);
  probabilityBoost = Math.min(probabilityBoost, URGENCY_THRESHOLDS.maxProbabilityBoost);

  return {
    adjustedKalshiWeight,
    adjustedLongTermWeight,
    confidenceMultiplier,
    evThresholdReduction,
    probabilityBoost,
    riskAdjustment,
    warnings,
    recommendations,
    urgencyActive,
    urgencyReason
  };
}

// Check if urgency mode should be activated
export function shouldActivateUrgencyMode(
  timeRemaining: number,
  kalshiRounds: Array<{
    timeRemaining: number;
    feasibilityScore: number;
    requiredMovePerMin: number;
  }>
): {
  activate: boolean;
  level: "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME";
  reason: string;
  affectedRounds: number;
} {
  if (timeRemaining <= URGENCY_THRESHOLDS.extremeTime) {
    const affectedRounds = kalshiRounds.filter(r => r.timeRemaining <= URGENCY_THRESHOLDS.extremeTime).length;
    return {
      activate: true,
      level: "EXTREME",
      reason: "Less than 2 minutes remaining",
      affectedRounds
    };
  }
  
  if (timeRemaining <= URGENCY_THRESHOLDS.highTime) {
    const affectedRounds = kalshiRounds.filter(r => r.timeRemaining <= URGENCY_THRESHOLDS.highTime).length;
    return {
      activate: true,
      level: "HIGH",
      reason: "Less than 5 minutes remaining",
      affectedRounds
    };
  }
  
  if (timeRemaining <= URGENCY_THRESHOLDS.elevatedTime) {
    const affectedRounds = kalshiRounds.filter(r => r.timeRemaining <= URGENCY_THRESHOLDS.elevatedTime).length;
    return {
      activate: true,
      level: "ELEVATED",
      reason: "Less than 10 minutes remaining",
      affectedRounds
    };
  }
  
  return {
    activate: false,
    level: "NORMAL",
    reason: "Sufficient time remaining",
    affectedRounds: 0
  };
}

// Get urgency mode status
export function getUrgencyModeStatus(
  metrics: UrgencyMetrics,
  adjustment: UrgencyAdjustment
): {
  status: "NORMAL" | "MONITORING" | "ACTIVE" | "CRITICAL";
  message: string;
  color: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  timeDisplay: string;
} {
  const timeDisplay = `${metrics.timeRemaining}m remaining`;
  
  if (metrics.urgencyLevel === "EXTREME") {
    return {
      status: "CRITICAL",
      message: "EXTREME urgency - final countdown",
      color: "#dc2626", // red
      urgency: "EXTREME",
      timeDisplay
    };
  }
  
  if (metrics.urgencyLevel === "HIGH") {
    return {
      status: "ACTIVE",
      message: "HIGH urgency - time critical",
      color: "#f97316", // orange
      urgency: "HIGH",
      timeDisplay
    };
  }
  
  if (metrics.urgencyLevel === "ELEVATED") {
    return {
      status: "MONITORING",
      message: "ELEVATED urgency - time aware",
      color: "#f59e0b", // amber
      urgency: "MEDIUM",
      timeDisplay
    };
  }
  
  return {
    status: "NORMAL",
    message: "Normal trading conditions",
    color: "#10b981", // green
    urgency: "LOW",
    timeDisplay
  };
}

// Calculate urgency-adjusted signal weights
export function calculateUrgencyAdjustedWeights(
  adjustment: UrgencyAdjustment,
  originalWeights: {
    momentum: number;
    volatility: number;
    meanReversion: number;
    orderFlow: number;
    kalshi: number;
    longTerm: number;
  }
): {
  momentum: number;
  volatility: number;
  meanReversion: number;
  orderFlow: number;
  kalshi: number;
  longTerm: number;
} {
  const totalOriginalWeight = Object.values(originalWeights).reduce((sum, w) => sum + w, 0);
  
  // Apply urgency adjustments
  const adjustedWeights = {
    momentum: originalWeights.momentum * adjustment.confidenceMultiplier,
    volatility: originalWeights.volatility * adjustment.confidenceMultiplier,
    meanReversion: originalWeights.meanReversion * adjustment.confidenceMultiplier,
    orderFlow: originalWeights.orderFlow * adjustment.confidenceMultiplier,
    kalshi: originalWeights.kalshi * adjustment.adjustedKalshiWeight / originalWeights.kalshi,
    longTerm: originalWeights.longTerm * adjustment.adjustedLongTermWeight / originalWeights.longTerm
  };
  
  // Normalize weights to sum to 1
  const totalAdjustedWeight = Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0);
  
  return Object.fromEntries(
    Object.entries(adjustedWeights).map(([key, weight]) => [key, weight / totalAdjustedWeight])
  ) as typeof adjustedWeights;
}

// Generate urgency mode recommendations
export function generateUrgencyRecommendations(
  metrics: UrgencyMetrics,
  adjustment: UrgencyAdjustment
): {
  priority: string;
  considerations: string[];
  actions: string[];
  riskWarnings: string[];
} {
  let priority = "Normal trading approach";
  const considerations: string[] = [];
  const actions: string[] = [];
  const riskWarnings: string[] = [];

  if (adjustment.urgencyActive) {
    priority = `URGENCY MODE: ${adjustment.urgencyReason}`;
    considerations.push(...adjustment.warnings);
    actions.push(...adjustment.recommendations);
    
    if (metrics.urgencyLevel === "EXTREME") {
      riskWarnings.push("High risk of overtrading in extreme urgency");
      riskWarnings.push("Probability calculations may be less reliable");
      riskWarnings.push("Market conditions can change rapidly");
    }
    
    if (metrics.feasibilityCritical) {
      considerations.push("Kalshi feasibility is critical factor");
      actions.push("Prioritize trades with high feasibility scores");
    }
    
    if (metrics.requiredMoveSpeed > URGENCY_THRESHOLDS.requiredMoveSpeedThreshold) {
      riskWarnings.push("Required price movement may be unrealistic");
      considerations.push("Verify volatility assumptions");
    }
  }

  return {
    priority,
    considerations,
    actions,
    riskWarnings
  };
}
