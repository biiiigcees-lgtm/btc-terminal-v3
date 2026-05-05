// lib/confidenceLanguage.ts — CONFIDENCE LANGUAGE system for Elite Decision Mode

export interface ConfidenceLevel {
  level: "HIGH CONVICTION" | "MEDIUM" | "LOW" | "NO EDGE";
  percentage: number;
  description: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  priority: number; // 1 = highest
  shouldTrade: boolean;
  recommendation: string;
}

// Confidence thresholds for Elite Decision Mode
export interface ConfidenceThresholds {
  highConviction: number;    // Minimum for HIGH CONVICTION
  medium: number;           // Minimum for MEDIUM
  low: number;              // Minimum for LOW
  noEdge: number;           // Below this is NO EDGE
}

// Default thresholds
const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  highConviction: 80,        // 80%+ for HIGH CONVICTION
  medium: 65,              // 65-79% for MEDIUM
  low: 50,                 // 50-64% for LOW
  noEdge: 50               // Below 50% is NO EDGE
};

// Confidence level definitions with visual styling
const CONFIDENCE_LEVELS: Record<string, Omit<ConfidenceLevel, 'percentage'>> = {
  "HIGH CONVICTION": {
    level: "HIGH CONVICTION",
    description: "Strong statistical confidence in signal",
    color: "#10b981",      // green
    backgroundColor: "#064e3b", // emerald-900
    borderColor: "#34d399",    // emerald-400
    priority: 1,
    shouldTrade: true,
    recommendation: "EXECUTE TRADE"
  },
  "MEDIUM": {
    level: "MEDIUM",
    description: "Moderate confidence - consider carefully",
    color: "#f59e0b",      // amber
    backgroundColor: "#78350f", // amber-900
    borderColor: "#fbbf24",    // amber-400
    priority: 2,
    shouldTrade: true,
    recommendation: "CONSIDER ENTRY"
  },
  "LOW": {
    level: "LOW",
    description: "Low confidence - high uncertainty",
    color: "#6b7280",      // gray
    backgroundColor: "#1f2937", // gray-800
    borderColor: "#9ca3af",    // gray-400
    priority: 3,
    shouldTrade: false,
    recommendation: "WAIT FOR BETTER SETUP"
  },
  "NO EDGE": {
    level: "NO EDGE",
    description: "No statistical edge - do not trade",
    color: "#ef4444",      // red
    backgroundColor: "#7f1d1d", // red-900
    borderColor: "#f87171",    // red-400
    priority: 4,
    shouldTrade: false,
    recommendation: "NO EDGE — WAIT"
  }
};

// Convert confidence percentage to confidence level
export function getConfidenceLevel(
  confidence: number,
  customThresholds?: Partial<ConfidenceThresholds>
): ConfidenceLevel {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  
  let level: "HIGH CONVICTION" | "MEDIUM" | "LOW" | "NO EDGE";
  
  if (confidence >= thresholds.highConviction) {
    level = "HIGH CONVICTION";
  } else if (confidence >= thresholds.medium) {
    level = "MEDIUM";
  } else if (confidence >= thresholds.low) {
    level = "LOW";
  } else {
    level = "NO EDGE";
  }
  
  const baseLevel = CONFIDENCE_LEVELS[level];
  
  return {
    ...baseLevel,
    percentage: confidence
  };
}

// Get confidence language for display
export function getConfidenceLanguage(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  return level.level;
}

// Get confidence description
export function getConfidenceDescription(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  return level.description;
}

// Get confidence recommendation
export function getConfidenceRecommendation(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  return level.recommendation;
}

// Check if confidence level allows trading
export function shouldTradeBasedOnConfidence(confidence: number): boolean {
  const level = getConfidenceLevel(confidence);
  return level.shouldTrade;
}

// Get confidence color for UI
export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  return level.color;
}

// Get confidence styling for UI
export function getConfidenceStyling(confidence: number): {
  color: string;
  backgroundColor: string;
  borderColor: string;
  shouldTrade: boolean;
  priority: number;
} {
  const level = getConfidenceLevel(confidence);
  return {
    color: level.color,
    backgroundColor: level.backgroundColor,
    borderColor: level.borderColor,
    shouldTrade: level.shouldTrade,
    priority: level.priority
  };
}

// Format confidence for display with language
export function formatConfidence(confidence: number): {
  percentage: number;
  language: string;
  description: string;
  recommendation: string;
  styling: {
    color: string;
    backgroundColor: string;
    borderColor: string;
  };
} {
  const level = getConfidenceLevel(confidence);
  
  return {
    percentage: Math.round(confidence),
    language: level.level,
    description: level.description,
    recommendation: level.recommendation,
    styling: {
      color: level.color,
      backgroundColor: level.backgroundColor,
      borderColor: level.borderColor
    }
  };
}

// Compare two confidence levels
export function compareConfidence(
  confidence1: number,
  confidence2: number
): "HIGHER" | "LOWER" | "EQUAL" {
  if (confidence1 > confidence2 + 2) return "HIGHER";
  if (confidence1 < confidence2 - 2) return "LOWER";
  return "EQUAL";
}

// Get confidence trend
export function getConfidenceTrend(
  currentConfidence: number,
  previousConfidence: number
): {
  trend: "IMPROVING" | "DECLINING" | "STABLE";
  change: number;
  significance: "MAJOR" | "MODERATE" | "MINOR";
} {
  const change = currentConfidence - previousConfidence;
  const absChange = Math.abs(change);
  
  let trend: "IMPROVING" | "DECLINING" | "STABLE";
  if (change > 3) trend = "IMPROVING";
  else if (change < -3) trend = "DECLINING";
  else trend = "STABLE";
  
  let significance: "MAJOR" | "MODERATE" | "MINOR";
  if (absChange > 10) significance = "MAJOR";
  else if (absChange > 5) significance = "MODERATE";
  else significance = "MINOR";
  
  return { trend, change: Math.round(change * 10) / 10, significance };
}

// Validate confidence value
export function validateConfidence(confidence: number): {
  isValid: boolean;
  normalizedValue: number;
  error?: string;
} {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return {
      isValid: false,
      normalizedValue: 0,
      error: "Confidence must be a number"
    };
  }
  
  if (confidence < 0) {
    return {
      isValid: false,
      normalizedValue: 0,
      error: "Confidence cannot be negative"
    };
  }
  
  if (confidence > 100) {
    return {
      isValid: false,
      normalizedValue: 100,
      error: "Confidence cannot exceed 100%"
    };
  }
  
  return {
    isValid: true,
    normalizedValue: confidence
  };
}

// Apply confidence cap (max 85% as per Elite Decision Mode)
export function applyConfidenceCap(confidence: number, maxCap: number = 85): {
  capped: boolean;
  originalValue: number;
  cappedValue: number;
  difference: number;
} {
  const validated = validateConfidence(confidence);
  const normalizedValue = validated.normalizedValue;
  
  if (normalizedValue > maxCap) {
    return {
      capped: true,
      originalValue: normalizedValue,
      cappedValue: maxCap,
      difference: normalizedValue - maxCap
    };
  }
  
  return {
    capped: false,
    originalValue: normalizedValue,
    cappedValue: normalizedValue,
    difference: 0
  };
}

// Get confidence summary for multiple signals
export function getConfidenceSummary(confidences: number[]): {
  average: number;
  highest: number;
  lowest: number;
  distribution: Record<string, number>;
  dominantLevel: string;
  recommendation: string;
} {
  if (confidences.length === 0) {
    return {
      average: 0,
      highest: 0,
      lowest: 0,
      distribution: {},
      dominantLevel: "NO EDGE",
      recommendation: "NO EDGE — WAIT"
    };
  }
  
  const average = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const highest = Math.max(...confidences);
  const lowest = Math.min(...confidences);
  
  // Count distribution
  const distribution: Record<string, number> = {
    "HIGH CONVICTION": 0,
    "MEDIUM": 0,
    "LOW": 0,
    "NO EDGE": 0
  };
  
  confidences.forEach(confidence => {
    const level = getConfidenceLevel(confidence);
    distribution[level.level]++;
  });
  
  // Find dominant level
  const dominantLevel = Object.entries(distribution)
    .sort(([, a], [, b]) => b - a)[0][0];
  
  const dominantLevelConfidence = getConfidenceLevel(
    dominantLevel === "HIGH CONVICTION" ? 85 :
    dominantLevel === "MEDIUM" ? 72 :
    dominantLevel === "LOW" ? 57 : 25
  );
  
  return {
    average: Math.round(average * 10) / 10,
    highest: Math.round(highest * 10) / 10,
    lowest: Math.round(lowest * 10) / 10,
    distribution,
    dominantLevel,
    recommendation: dominantLevelConfidence.recommendation
  };
}
