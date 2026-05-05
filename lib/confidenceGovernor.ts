// lib/confidenceGovernor.ts — CONFIDENCE GOVERNOR: cap probability at 85%, adjust for conflicts

export interface ConfidenceFactors {
  originalProbability: number;
  originalConfidence: number;
  timeframeAlignment: number;     // 0-1, how well timeframes align
  volatilityMatch: number;       // 0-1, volatility vs required move
  consensusStrength: number;     // 0-1, agent agreement strength
  kalshiFeasibility: number;     // 0-1, Kalshi target feasibility
  lateRoundRandomness: number;   // 0-1, how close to expiration
  conflictingSignals: number;    // 0-1, presence of conflicts
  marketRegime: number;          // 0-1, regime stability
}

export interface ConfidenceAdjustment {
  adjustedProbability: number;
  adjustedConfidence: number;
  probabilityCap: number;
  confidenceCap: number;
  adjustments: {
    timeframePenalty: number;
    volatilityPenalty: number;
    consensusPenalty: number;
    feasibilityPenalty: number;
    randomnessPenalty: number;
    conflictPenalty: number;
    regimePenalty: number;
  };
  reasons: string[];
  warnings: string[];
  finalGrade: "A" | "B" | "C" | "D" | "F";
}

// Confidence governor configuration
const CONFIDENCE_LIMITS = {
  maxProbability: 85,        // Hard cap at 85%
  maxConfidence: 90,          // Hard cap at 90%
  minProbability: 30,         // Minimum threshold
  minConfidence: 40           // Minimum threshold
};

// Penalty weights (sum to 1.0)
const PENALTY_WEIGHTS = {
  timeframe: 0.20,            // 20% weight
  volatility: 0.15,           // 15% weight
  consensus: 0.25,           // 25% weight
  feasibility: 0.20,         // 20% weight
  randomness: 0.10,          // 10% weight
  conflicts: 0.05,           // 5% weight
  regime: 0.05               // 5% weight
};

// Apply confidence governance
export function applyConfidenceGovernor(
  originalProbability: number,
  originalConfidence: number,
  factors: ConfidenceFactors
): ConfidenceAdjustment {
  const adjustments = calculateAdjustments(factors);
  const reasons = generateAdjustmentReasons(factors, adjustments);
  const warnings = generateWarnings(factors, adjustments);

  // Calculate adjusted probability
  let adjustedProbability = originalProbability;
  
  // Apply penalties
  const totalProbabilityPenalty = 
    adjustments.timeframePenalty +
    adjustments.volatilityPenalty +
    adjustments.consensusPenalty +
    adjustments.feasibilityPenalty +
    adjustments.randomnessPenalty +
    adjustments.conflictPenalty +
    adjustments.regimePenalty;

  adjustedProbability *= (1 - totalProbabilityPenalty);

  // Apply hard caps
  adjustedProbability = Math.min(adjustedProbability, CONFIDENCE_LIMITS.maxProbability);
  adjustedProbability = Math.max(adjustedProbability, CONFIDENCE_LIMITS.minProbability);

  // Calculate adjusted confidence
  let adjustedConfidence = originalConfidence;
  
  // Confidence penalties (similar but slightly different weights)
  const totalConfidencePenalty = 
    adjustments.timeframePenalty * 0.8 +      // Timeframe affects confidence less
    adjustments.volatilityPenalty * 1.2 +    // Volatility affects confidence more
    adjustments.consensusPenalty * 1.5 +     // Consensus strongly affects confidence
    adjustments.feasibilityPenalty * 1.0 +   // Feasibility affects confidence
    adjustments.randomnessPenalty * 1.8 +    // Randomness heavily affects confidence
    adjustments.conflictPenalty * 2.0 +     // Conflicts heavily affect confidence
    adjustments.regimePenalty * 0.6;        // Regime affects confidence moderately

  adjustedConfidence *= (1 - Math.min(totalConfidencePenalty, 0.8)); // Max 80% reduction

  // Apply hard caps
  adjustedConfidence = Math.min(adjustedConfidence, CONFIDENCE_LIMITS.maxConfidence);
  adjustedConfidence = Math.max(adjustedConfidence, CONFIDENCE_LIMITS.minConfidence);

  // Determine final grade
  const finalGrade = calculateFinalGrade(adjustedProbability, adjustedConfidence);

  return {
    adjustedProbability: Math.round(adjustedProbability),
    adjustedConfidence: Math.round(adjustedConfidence),
    probabilityCap: CONFIDENCE_LIMITS.maxProbability,
    confidenceCap: CONFIDENCE_LIMITS.maxConfidence,
    adjustments,
    reasons,
    warnings,
    finalGrade
  };
}

// Calculate individual adjustments
function calculateAdjustments(factors: ConfidenceFactors): ConfidenceAdjustment['adjustments'] {
  // Timeframe penalty (conflicting timeframes reduce confidence)
  let timeframePenalty = 0;
  if (factors.timeframeAlignment < 0.7) timeframePenalty = (0.7 - factors.timeframeAlignment) * 0.3;
  else if (factors.timeframeAlignment < 0.5) timeframePenalty = 0.15;

  // Volatility penalty (mismatch between volatility and required move)
  let volatilityPenalty = 0;
  if (factors.volatilityMatch < 0.6) volatilityPenalty = (0.6 - factors.volatilityMatch) * 0.4;
  else if (factors.volatilityMatch < 0.4) volatilityPenalty = 0.2;

  // Consensus penalty (weak consensus reduces confidence)
  let consensusPenalty = 0;
  if (factors.consensusStrength < 0.7) consensusPenalty = (0.7 - factors.consensusStrength) * 0.3;
  else if (factors.consensusStrength < 0.5) consensusPenalty = 0.15;

  // Feasibility penalty (low feasibility reduces confidence)
  let feasibilityPenalty = 0;
  if (factors.kalshiFeasibility < 0.6) feasibilityPenalty = (0.6 - factors.kalshiFeasibility) * 0.4;
  else if (factors.kalshiFeasibility < 0.4) feasibilityPenalty = 0.2;

  // Randomness penalty (late-round randomness reduces confidence)
  let randomnessPenalty = 0;
  if (factors.lateRoundRandomness > 0.7) randomnessPenalty = (factors.lateRoundRandomness - 0.7) * 0.5;
  else if (factors.lateRoundRandomness > 0.5) randomnessPenalty = 0.1;

  // Conflict penalty (conflicting signals reduce confidence)
  let conflictPenalty = 0;
  if (factors.conflictingSignals > 0.3) conflictPenalty = (factors.conflictingSignals - 0.3) * 0.6;
  else if (factors.conflictingSignals > 0.1) conflictPenalty = 0.05;

  // Regime penalty (unstable regime reduces confidence)
  let regimePenalty = 0;
  if (factors.marketRegime < 0.6) regimePenalty = (0.6 - factors.marketRegime) * 0.2;
  else if (factors.marketRegime < 0.4) regimePenalty = 0.1;

  return {
    timeframePenalty,
    volatilityPenalty,
    consensusPenalty,
    feasibilityPenalty,
    randomnessPenalty,
    conflictPenalty,
    regimePenalty
  };
}

// Generate adjustment reasons
function generateAdjustmentReasons(
  factors: ConfidenceFactors,
  adjustments: ConfidenceAdjustment['adjustments']
): string[] {
  const reasons: string[] = [];

  if (adjustments.timeframePenalty > 0.05) {
    reasons.push(`Conflicting timeframes detected (${Math.round(factors.timeframeAlignment * 100)}% alignment)`);
  }

  if (adjustments.volatilityPenalty > 0.05) {
    reasons.push(`Volatility mismatch with required move (${Math.round(factors.volatilityMatch * 100)}% match)`);
  }

  if (adjustments.consensusPenalty > 0.05) {
    reasons.push(`Weak agent consensus (${Math.round(factors.consensusStrength * 100)}% agreement)`);
  }

  if (adjustments.feasibilityPenalty > 0.05) {
    reasons.push(`Low Kalshi feasibility (${Math.round(factors.kalshiFeasibility * 100)}% feasible)`);
  }

  if (adjustments.randomnessPenalty > 0.05) {
    reasons.push(`Late-round randomness (${Math.round(factors.lateRoundRandomness * 100)}% random)`);
  }

  if (adjustments.conflictPenalty > 0.05) {
    reasons.push(`Conflicting signals detected (${Math.round(factors.conflictingSignals * 100)}% conflict)`);
  }

  if (adjustments.regimePenalty > 0.05) {
    reasons.push(`Unstable market regime (${Math.round(factors.marketRegime * 100)}% stable)`);
  }

  return reasons;
}

// Generate warnings
function generateWarnings(
  factors: ConfidenceFactors,
  adjustments: ConfidenceAdjustment['adjustments']
): string[] {
  const warnings: string[] = [];

  if (factors.lateRoundRandomness > 0.8) {
    warnings.push("High randomness near expiration - probability may be unreliable");
  }

  if (factors.conflictingSignals > 0.5) {
    warnings.push("Multiple conflicting signals - high uncertainty");
  }

  if (factors.volatilityMatch < 0.3) {
    warnings.push("Current volatility insufficient for required price movement");
  }

  if (factors.consensusStrength < 0.4) {
    warnings.push("Very low agent consensus - signal reliability questionable");
  }

  if (factors.kalshiFeasibility < 0.3) {
    warnings.push("Kalshi target appears unrealistic - probability adjusted downward");
  }

  const totalPenalty = Object.values(adjustments).reduce((sum, penalty) => sum + penalty, 0);
  if (totalPenalty > 0.4) {
    warnings.push("Multiple confidence factors degraded - exercise extreme caution");
  }

  return warnings;
}

// Calculate final grade
function calculateFinalGrade(probability: number, confidence: number): "A" | "B" | "C" | "D" | "F" {
  const score = (probability + confidence) / 2;

  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 55) return "D";
  return "F";
}

// Validate confidence factors
export function validateConfidenceFactors(factors: ConfidenceFactors): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check ranges
  if (factors.originalProbability < 0 || factors.originalProbability > 100) {
    errors.push("Original probability must be between 0-100");
  }

  if (factors.originalConfidence < 0 || factors.originalConfidence > 100) {
    errors.push("Original confidence must be between 0-100");
  }

  // Check factor ranges
  Object.entries(factors).forEach(([key, value]) => {
    if (key !== 'originalProbability' && key !== 'originalConfidence') {
      if (value < 0 || value > 1) {
        errors.push(`${key} must be between 0-1`);
      }
    }
  });

  // Warnings for unusual combinations
  if (factors.originalProbability > 80 && factors.consensusStrength < 0.5) {
    warnings.push("High probability with low consensus - unusual combination");
  }

  if (factors.originalConfidence > 85 && factors.volatilityMatch < 0.4) {
    warnings.push("High confidence with poor volatility match - potential overconfidence");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Get confidence governor status
export function getConfidenceGovernorStatus(adjustment: ConfidenceAdjustment): {
  status: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL";
  message: string;
  color: string;
  actionLevel: "EXECUTE" | "CONSIDER" | "CAUTION" | "AVOID";
} {
  const { adjustedProbability, adjustedConfidence, warnings, finalGrade } = adjustment;

  if (finalGrade === "A" && warnings.length === 0) {
    return {
      status: "EXCELLENT",
      message: "High confidence with no significant issues",
      color: "#10b981", // green
      actionLevel: "EXECUTE"
    };
  }

  if (finalGrade === "A" || (finalGrade === "B" && warnings.length <= 1)) {
    return {
      status: "GOOD",
      message: "Good confidence with minor considerations",
      color: "#3b82f6", // blue
      actionLevel: "CONSIDER"
    };
  }

  if (finalGrade === "B" || (finalGrade === "C" && warnings.length <= 2)) {
    return {
      status: "FAIR",
      message: "Moderate confidence with some concerns",
      color: "#f59e0b", // amber
      actionLevel: "CAUTION"
    };
  }

  if (finalGrade === "C" || finalGrade === "D") {
    return {
      status: "POOR",
      message: "Low confidence with significant issues",
      color: "#f97316", // orange
      actionLevel: "CAUTION"
    };
  }

  return {
    status: "CRITICAL",
    message: "Very low confidence - avoid trading",
    color: "#ef4444", // red
    actionLevel: "AVOID"
  };
}

// Apply emergency confidence reduction
export function applyEmergencyConfidenceReduction(
  adjustment: ConfidenceAdjustment,
  reason: string
): ConfidenceAdjustment {
  const emergencyReduction = 0.3; // 30% reduction

  return {
    ...adjustment,
    adjustedProbability: Math.max(
      CONFIDENCE_LIMITS.minProbability,
      Math.round(adjustment.adjustedProbability * (1 - emergencyReduction))
    ),
    adjustedConfidence: Math.max(
      CONFIDENCE_LIMITS.minConfidence,
      Math.round(adjustment.adjustedConfidence * (1 - emergencyReduction))
    ),
    warnings: [...adjustment.warnings, `Emergency reduction applied: ${reason}`]
  };
}
