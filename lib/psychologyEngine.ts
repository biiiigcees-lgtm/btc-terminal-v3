// lib/psychologyEngine.ts — USER PSYCHOLOGY FIX: reduce noise, increase clarity, encourage patience

export interface PsychologyMetrics {
  noiseLevel: number;           // 0-100, lower is better
  clarityScore: number;         // 0-100, higher is better
  patienceScore: number;        // 0-100, higher is better
  decisionQuality: number;     // 0-100, higher is better
  userStress: number;           // 0-100, lower is better
  cognitiveLoad: number;       // 0-100, lower is better
}

export interface PsychologyRecommendation {
  type: "REDUCE_NOISE" | "IMPROVE_CLARITY" | "ENCOURAGE_PATIENCE" | "MANAGE_STRESS";
  priority: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  action: string;
  expectedImpact: string;
  implementation: string;
}

export interface PsychologyProfile {
  currentMetrics: PsychologyMetrics;
  recommendations: PsychologyRecommendation[];
  overallWellbeing: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  primaryFocus: string;
  actionPlan: string[];
}

// Psychology thresholds for Elite Decision Mode
const PSYCHOLOGY_THRESHOLDS = {
  maxNoiseLevel: 30,          // Maximum acceptable noise
  minClarityScore: 70,         // Minimum clarity required
  minPatienceScore: 60,       // Minimum patience level
  minDecisionQuality: 75,     // Minimum decision quality
  maxUserStress: 40,          // Maximum acceptable stress
  maxCognitiveLoad: 50        // Maximum cognitive load
};

// Calculate psychology metrics based on system behavior
export function calculatePsychologyMetrics(
  signalFrequency: number,          // Signals per hour
  signalQuality: number,            // Average signal quality (0-100)
  updateFrequency: number,          // Updates per hour
  decisionComplexity: number,      // Complexity of decisions (0-100)
  userInteractions: number,         // User actions per hour
  errorRate: number                 // System errors per hour
): PsychologyMetrics {
  // Noise level: based on signal frequency and quality
  const noiseScore = Math.min(100, 
    (signalFrequency / 10) * 50 +    // More signals = more noise
    ((100 - signalQuality) / 100) * 30 + // Lower quality = more noise
    (updateFrequency / 20) * 20     // More updates = more noise
  );
  
  // Clarity score: based on signal quality and decision complexity
  const clarityScore = Math.max(0, Math.min(100,
    signalQuality * 0.6 +           // Signal quality impact
    ((100 - decisionComplexity) / 100) * 30 + // Simpler = clearer
    ((100 - errorRate) / 100) * 10 // Fewer errors = clearer
  ));
  
  // Patience score: based on user interaction patterns
  const patienceScore = Math.max(0, Math.min(100,
    100 - (userInteractions / 30) * 40 + // Fewer interactions = more patience
    (100 - signalFrequency / 10) * 30 +  // Fewer signals = more patience
    ((100 - updateFrequency) / 20) * 30   // Fewer updates = more patience
  ));
  
  // Decision quality: based on signal quality and complexity
  const decisionQuality = Math.max(0, Math.min(100,
    signalQuality * 0.5 +           // Signal quality
    ((100 - decisionComplexity) / 100) * 30 + // Simpler decisions
    ((100 - errorRate) / 100) * 20 // Fewer errors
  ));
  
  // User stress: based on cognitive load and noise
  const userStress = Math.min(100,
    noiseScore * 0.4 +             // Noise causes stress
    decisionComplexity * 0.3 +      // Complex decisions cause stress
    errorRate * 0.2 +              // Errors cause stress
    (userInteractions / 20) * 0.1  // Too many interactions cause stress
  );
  
  // Cognitive load: based on information processing requirements
  const cognitiveLoad = Math.min(100,
    (signalFrequency / 10) * 30 +   // More signals = higher load
    decisionComplexity * 0.4 +     // Complex decisions = higher load
    (updateFrequency / 20) * 20 +  // More updates = higher load
    errorRate * 0.1               // Errors increase load
  );
  
  return {
    noiseLevel: Math.round(noiseScore),
    clarityScore: Math.round(clarityScore),
    patienceScore: Math.round(patienceScore),
    decisionQuality: Math.round(decisionQuality),
    userStress: Math.round(userStress),
    cognitiveLoad: Math.round(cognitiveLoad)
  };
}

// Generate psychology recommendations
export function generatePsychologyRecommendations(
  metrics: PsychologyMetrics
): PsychologyRecommendation[] {
  const recommendations: PsychologyRecommendation[] = [];
  
  // Noise reduction recommendations
  if (metrics.noiseLevel > PSYCHOLOGY_THRESHOLDS.maxNoiseLevel) {
    recommendations.push({
      type: "REDUCE_NOISE",
      priority: metrics.noiseLevel > 60 ? "HIGH" : "MEDIUM",
      message: "System is generating too much noise",
      action: "Implement stricter signal filtering",
      expectedImpact: "Reduce cognitive load by 40%",
      implementation: "Increase EV threshold, reduce update frequency"
    });
  }
  
  // Clarity improvement recommendations
  if (metrics.clarityScore < PSYCHOLOGY_THRESHOLDS.minClarityScore) {
    recommendations.push({
      type: "IMPROVE_CLARITY",
      priority: metrics.clarityScore < 50 ? "HIGH" : "MEDIUM",
      message: "Signal clarity needs improvement",
      action: "Simplify decision presentation",
      expectedImpact: "Increase decision accuracy by 25%",
      implementation: "Use clear language, highlight key metrics only"
    });
  }
  
  // Patience encouragement recommendations
  if (metrics.patienceScore < PSYCHOLOGY_THRESHOLDS.minPatienceScore) {
    recommendations.push({
      type: "ENCOURAGE_PATIENCE",
      priority: metrics.patienceScore < 40 ? "HIGH" : "MEDIUM",
      message: "User needs more time between decisions",
      action: "Implement longer cooldown periods",
      expectedImpact: "Reduce impulsive trading by 35%",
      implementation: "Extend signal cooldown to 5+ minutes"
    });
  }
  
  // Stress management recommendations
  if (metrics.userStress > PSYCHOLOGY_THRESHOLDS.maxUserStress) {
    recommendations.push({
      type: "MANAGE_STRESS",
      priority: metrics.userStress > 70 ? "HIGH" : "MEDIUM",
      message: "User stress levels are too high",
      action: "Reduce information overload",
      expectedImpact: "Improve decision quality by 20%",
      implementation: "Hide secondary metrics, focus on primary signals"
    });
  }
  
  return recommendations;
}

// Create psychology profile
export function createPsychologyProfile(
  metrics: PsychologyMetrics,
  recommendations: PsychologyRecommendation[]
): PsychologyProfile {
  // Calculate overall wellbeing score
  const wellbeingScore = (
    (100 - metrics.noiseLevel) * 0.2 +
    metrics.clarityScore * 0.2 +
    metrics.patienceScore * 0.2 +
    metrics.decisionQuality * 0.2 +
    (100 - metrics.userStress) * 0.1 +
    (100 - metrics.cognitiveLoad) * 0.1
  );
  
  let overallWellbeing: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  if (wellbeingScore >= 85) overallWellbeing = "EXCELLENT";
  else if (wellbeingScore >= 70) overallWellbeing = "GOOD";
  else if (wellbeingScore >= 55) overallWellbeing = "FAIR";
  else overallWellbeing = "POOR";
  
  // Determine primary focus
  const primaryFocus = recommendations.length > 0 ? 
    recommendations[0].type : "MAINTAIN_CURRENT";
  
  // Create action plan
  const actionPlan = recommendations.map(rec => rec.implementation);
  
  return {
    currentMetrics: metrics,
    recommendations,
    overallWellbeing,
    primaryFocus,
    actionPlan
  };
}

// Apply psychology fixes to system behavior
export function applyPsychologyFixes(
  currentBehavior: any,
  profile: PsychologyProfile
): any {
  const fixes = { ...currentBehavior };
  
  // Apply noise reduction
  if (profile.primaryFocus === "REDUCE_NOISE") {
    fixes.signalFiltering = {
      minEV: 0.05,              // Higher EV threshold
      minProbability: 58,       // Higher probability threshold
      maxSignalsPerHour: 5,     // Limit signal frequency
      updateInterval: 60000     // 1 minute minimum between updates
    };
  }
  
  // Apply clarity improvements
  if (profile.primaryFocus === "IMPROVE_CLARITY") {
    fixes.displaySettings = {
      showOnlyBestTrade: true,   // Single trade focus
      hideSecondaryMetrics: true, // Reduce information
      useSimpleLanguage: true,   // Clear terminology
      highlightKeyNumbers: true   // Emphasize important data
    };
  }
  
  // Apply patience encouragement
  if (profile.primaryFocus === "ENCOURAGE_PATIENCE") {
    fixes.timingSettings = {
      signalCooldown: 300000,    // 5 minutes between signals
      decisionDelay: 10000,      // 10 seconds before confirming
      patienceReminders: true    // Encourage waiting
    };
  }
  
  // Apply stress management
  if (profile.primaryFocus === "MANAGE_STRESS") {
    fixes.stressReduction = {
      limitNotifications: true,  // Reduce alerts
      simplifyInterface: true,    // Clean UI
      provideBreaks: true,        // Suggest breaks
      hideComplexData: true        // Hide advanced metrics
    };
  }
  
  return fixes;
}

// Monitor psychology impact over time
export function monitorPsychologyImpact(
  beforeMetrics: PsychologyMetrics,
  afterMetrics: PsychologyMetrics
): {
  improvements: Record<string, number>;
  degradations: Record<string, number>;
  overallImpact: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  recommendations: string[];
} {
  const improvements: Record<string, number> = {};
  const degradations: Record<string, number> = {};
  
  // Calculate changes
  const changes = {
    noiseLevel: beforeMetrics.noiseLevel - afterMetrics.noiseLevel,
    clarityScore: afterMetrics.clarityScore - beforeMetrics.clarityScore,
    patienceScore: afterMetrics.patienceScore - beforeMetrics.patienceScore,
    decisionQuality: afterMetrics.decisionQuality - beforeMetrics.decisionQuality,
    userStress: beforeMetrics.userStress - afterMetrics.userStress,
    cognitiveLoad: beforeMetrics.cognitiveLoad - afterMetrics.cognitiveLoad
  };
  
  // Categorize changes
  Object.entries(changes).forEach(([key, change]) => {
    if (change > 5) {
      improvements[key] = change;
    } else if (change < -5) {
      degradations[key] = Math.abs(change);
    }
  });
  
  // Determine overall impact
  const totalImprovement = Object.values(improvements).reduce((sum, val) => sum + val, 0);
  const totalDegradation = Object.values(degradations).reduce((sum, val) => sum + val, 0);
  
  let overallImpact: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  if (totalImprovement > totalDegradation + 10) overallImpact = "POSITIVE";
  else if (totalDegradation > totalImprovement + 10) overallImpact = "NEGATIVE";
  else overallImpact = "NEUTRAL";
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (Object.keys(degradations).length > 0) {
    recommendations.push("Address areas showing degradation");
  }
  
  if (overallImpact === "NEGATIVE") {
    recommendations.push("Revert to previous settings");
    recommendations.push("Consult user preference changes");
  }
  
  if (overallImpact === "POSITIVE") {
    recommendations.push("Continue current psychology optimizations");
    recommendations.push("Consider further improvements");
  }
  
  return {
    improvements,
    degradations,
    overallImpact,
    recommendations
  };
}

// Get psychology status message
export function getPsychologyStatusMessage(profile: PsychologyProfile): {
  status: string;
  message: string;
  color: string;
  urgency: "LOW" | "MEDIUM" | "HIGH";
} {
  const { overallWellbeing, primaryFocus, currentMetrics } = profile;
  
  let status: string;
  let message: string;
  let color: string;
  let urgency: "LOW" | "MEDIUM" | "HIGH";
  
  if (overallWellbeing === "EXCELLENT") {
    status = "OPTIMAL";
    message = "System psychology is excellent";
    color = "#10b981"; // green
    urgency = "LOW";
  } else if (overallWellbeing === "GOOD") {
    status = "HEALTHY";
    message = "System psychology is good";
    color = "#3b82f6"; // blue
    urgency = "LOW";
  } else if (overallWellbeing === "FAIR") {
    status = "NEEDS ATTENTION";
    message = `Focus on ${primaryFocus.replace(/_/g, ' ').toLowerCase()}`;
    color = "#f59e0b"; // amber
    urgency = "MEDIUM";
  } else {
    status = "CRITICAL";
    message = "System psychology requires immediate attention";
    color = "#ef4444"; // red
    urgency = "HIGH";
  }
  
  return { status, message, color, urgency };
}
