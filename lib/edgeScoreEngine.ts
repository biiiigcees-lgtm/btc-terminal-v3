// lib/edgeScoreEngine.ts — EDGE SCORE metric (0-100) with weighted EV + probability + consensus + feasibility

export interface EdgeScoreComponents {
  ev: number;
  probability: number;
  consensus: number;
  feasibility: number;
  kellyFraction: number;
  riskReward: number;
  volatilityAlignment: number;
  timeDecayFactor: number;
}

export interface EdgeScoreResult {
  score: number;           // 0-100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  components: EdgeScoreComponents;
  weightedScore: number;
  recommendation: string;
  actionability: "EXECUTE" | "CONSIDER" | "CAUTION" | "AVOID";
  confidence: number;      // 0-100
  breakdown: {
    evScore: number;
    probabilityScore: number;
    consensusScore: number;
    feasibilityScore: number;
    riskScore: number;
    timingScore: number;
  };
}

// Edge score weights (sum to 100)
const EDGE_SCORE_WEIGHTS = {
  ev: 35,              // 35% - Most important
  probability: 25,     // 25% - Very important
  consensus: 20,       // 20% - Important
  feasibility: 15,     // 15% - Important
  risk: 5              // 5% - Secondary factor
};

// Calculate individual component scores
export function calculateComponentScores(components: EdgeScoreComponents): {
  evScore: number;
  probabilityScore: number;
  consensusScore: number;
  feasibilityScore: number;
  riskScore: number;
  timingScore: number;
} {
  // EV Score (0-100)
  let evScore = 0;
  if (components.ev >= 0.10) evScore = 100;        // Excellent
  else if (components.ev >= 0.08) evScore = 90;   // Very Good
  else if (components.ev >= 0.06) evScore = 80;   // Good
  else if (components.ev >= 0.04) evScore = 70;   // Fair
  else if (components.ev >= 0.02) evScore = 60;   // Poor
  else if (components.ev >= 0.01) evScore = 50;   // Very Poor
  else evScore = 0;                                // No Edge

  // Probability Score (0-100)
  let probabilityScore = 0;
  if (components.probability >= 75) probabilityScore = 100;
  else if (components.probability >= 70) probabilityScore = 95;
  else if (components.probability >= 65) probabilityScore = 90;
  else if (components.probability >= 60) probabilityScore = 85;
  else if (components.probability >= 55) probabilityScore = 75;
  else if (components.probability >= 50) probabilityScore = 65;
  else if (components.probability >= 45) probabilityScore = 50;
  else probabilityScore = 0;

  // Consensus Score (0-100)
  let consensusScore = 0;
  if (components.consensus >= 85) consensusScore = 100;
  else if (components.consensus >= 80) consensusScore = 95;
  else if (components.consensus >= 75) consensusScore = 90;
  else if (components.consensus >= 70) consensusScore = 85;
  else if (components.consensus >= 65) consensusScore = 80;
  else if (components.consensus >= 60) consensusScore = 70;
  else if (components.consensus >= 55) consensusScore = 60;
  else consensusScore = 0;

  // Feasibility Score (0-100)
  let feasibilityScore = 0;
  if (components.feasibility >= 90) feasibilityScore = 100;
  else if (components.feasibility >= 80) feasibilityScore = 95;
  else if (components.feasibility >= 70) feasibilityScore = 90;
  else if (components.feasibility >= 60) feasibilityScore = 80;
  else if (components.feasibility >= 50) feasibilityScore = 70;
  else if (components.feasibility >= 40) feasibilityScore = 60;
  else feasibilityScore = 0;

  // Risk Score (0-100) - Higher is better for risk management
  let riskScore = 0;
  
  // Kelly Fraction component (optimal is 0.1-0.25)
  let kellyScore = 0;
  if (components.kellyFraction >= 0.1 && components.kellyFraction <= 0.25) kellyScore = 100;
  else if (components.kellyFraction >= 0.05 && components.kellyFraction <= 0.3) kellyScore = 80;
  else if (components.kellyFraction > 0 && components.kellyFraction <= 0.4) kellyScore = 60;
  else kellyScore = 0;

  // Risk/Reward component (higher is better, min 1.5)
  let riskRewardScore = 0;
  if (components.riskReward >= 3) riskRewardScore = 100;
  else if (components.riskReward >= 2.5) riskRewardScore = 90;
  else if (components.riskReward >= 2) riskRewardScore = 80;
  else if (components.riskReward >= 1.5) riskRewardScore = 70;
  else riskRewardScore = 0;

  riskScore = (kellyScore + riskRewardScore) / 2;

  // Timing Score (0-100) - Based on volatility alignment and time decay
  let timingScore = 0;
  
  // Volatility alignment (higher is better)
  let volatilityScore = components.volatilityAlignment * 100;
  
  // Time decay (lower decay is better)
  let timeDecayScore = (1 - components.timeDecayFactor) * 100;
  
  timingScore = (volatilityScore + timeDecayScore) / 2;

  return {
    evScore,
    probabilityScore,
    consensusScore,
    feasibilityScore,
    riskScore,
    timingScore
  };
}

// Calculate comprehensive edge score
export function calculateEdgeScore(components: EdgeScoreComponents): EdgeScoreResult {
  const breakdown = calculateComponentScores(components);

  // Calculate weighted score
  const weightedScore = 
    (breakdown.evScore * EDGE_SCORE_WEIGHTS.ev / 100) +
    (breakdown.probabilityScore * EDGE_SCORE_WEIGHTS.probability / 100) +
    (breakdown.consensusScore * EDGE_SCORE_WEIGHTS.consensus / 100) +
    (breakdown.feasibilityScore * EDGE_SCORE_WEIGHTS.feasibility / 100) +
    (breakdown.riskScore * EDGE_SCORE_WEIGHTS.risk / 100);

  // Add timing bonus/penalty
  const timingAdjustment = (breakdown.timingScore - 50) * 0.1; // +/- 5 points max
  const finalScore = Math.max(0, Math.min(100, weightedScore + timingAdjustment));

  // Determine grade
  let grade: "A+" | "A" | "B" | "C" | "D" | "F";
  if (finalScore >= 95) grade = "A+";
  else if (finalScore >= 90) grade = "A";
  else if (finalScore >= 80) grade = "B";
  else if (finalScore >= 70) grade = "C";
  else if (finalScore >= 60) grade = "D";
  else grade = "F";

  // Determine recommendation and actionability
  let recommendation: string;
  let actionability: "EXECUTE" | "CONSIDER" | "CAUTION" | "AVOID";

  if (finalScore >= 85) {
    recommendation = "Strong edge detected - Execute trade";
    actionability = "EXECUTE";
  } else if (finalScore >= 75) {
    recommendation = "Good edge - Consider entry";
    actionability = "CONSIDER";
  } else if (finalScore >= 65) {
    recommendation = "Moderate edge - Exercise caution";
    actionability = "CAUTION";
  } else {
    recommendation = "Weak or no edge - Avoid trade";
    actionability = "AVOID";
  }

  // Calculate confidence based on score consistency
  const scoreVariance = calculateScoreVariance(breakdown);
  const confidence = Math.max(0, 100 - (scoreVariance * 2)); // Lower variance = higher confidence

  return {
    score: Math.round(finalScore),
    grade,
    components,
    weightedScore: Math.round(weightedScore * 10) / 10,
    recommendation,
    actionability,
    confidence: Math.round(confidence),
    breakdown
  };
}

// Calculate score variance (consistency measure)
function calculateScoreVariance(breakdown: {
  evScore: number;
  probabilityScore: number;
  consensusScore: number;
  feasibilityScore: number;
  riskScore: number;
  timingScore: number;
}): number {
  const scores = [
    breakdown.evScore,
    breakdown.probabilityScore,
    breakdown.consensusScore,
    breakdown.feasibilityScore,
    breakdown.riskScore,
    breakdown.timingScore
  ];

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  
  return Math.sqrt(variance); // Standard deviation
}

// Check if edge score meets minimum threshold
export function meetsEdgeScoreThreshold(
  edgeScore: EdgeScoreResult,
  threshold: number = 65
): boolean {
  return edgeScore.score >= threshold;
}

// Compare two edge scores
export function compareEdgeScores(
  score1: EdgeScoreResult,
  score2: EdgeScoreResult
): {
  winner: "score1" | "score2" | "equal";
  difference: number;
  significance: "MAJOR" | "MODERATE" | "MINIMAL";
} {
  const difference = Math.abs(score1.score - score2.score);
  
  let significance: "MAJOR" | "MODERATE" | "MINIMAL";
  if (difference >= 15) significance = "MAJOR";
  else if (difference >= 8) significance = "MODERATE";
  else significance = "MINIMAL";

  let winner: "score1" | "score2" | "equal";
  if (score1.score > score2.score + 2) winner = "score1";
  else if (score2.score > score1.score + 2) winner = "score2";
  else winner = "equal";

  return { winner, difference: Math.round(difference), significance };
}

// Get edge score trend over time
export function getEdgeScoreTrend(
  currentScore: EdgeScoreResult,
  historicalScores: EdgeScoreResult[]
): {
  trend: "IMPROVING" | "DECLINING" | "STABLE";
  momentum: number;
  consistency: number;
} {
  if (historicalScores.length < 3) {
    return { trend: "STABLE", momentum: 0, consistency: 50 };
  }

  const recentScores = [currentScore, ...historicalScores.slice(0, 4)]; // Last 5 scores
  const scoreValues = recentScores.map(s => s.score);

  // Calculate trend
  const recentAvg = scoreValues.slice(0, 3).reduce((sum, s) => sum + s, 0) / 3;
  const olderAvg = scoreValues.slice(3).reduce((sum, s) => sum + s, 0) / 2;
  
  let trend: "IMPROVING" | "DECLINING" | "STABLE";
  if (recentAvg > olderAvg + 3) trend = "IMPROVING";
  else if (recentAvg < olderAvg - 3) trend = "DECLINING";
  else trend = "STABLE";

  // Calculate momentum (rate of change)
  const momentum = recentAvg - olderAvg;

  // Calculate consistency (inverse of variance)
  const mean = scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length;
  const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scoreValues.length;
  const consistency = Math.max(0, 100 - Math.sqrt(variance));

  return {
    trend,
    momentum: Math.round(momentum * 10) / 10,
    consistency: Math.round(consistency)
  };
}

// Create edge score summary for display
export function createEdgeScoreSummary(edgeScore: EdgeScoreResult): {
  score: number;
  grade: string;
  actionability: string;
  recommendation: string;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  keyMetrics: {
    ev: string;
    probability: string;
    consensus: string;
    feasibility: string;
  };
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Analyze components
  if (edgeScore.breakdown.evScore >= 80) strengths.push("Strong expected value");
  else if (edgeScore.breakdown.evScore < 50) weaknesses.push("Weak expected value");

  if (edgeScore.breakdown.probabilityScore >= 80) strengths.push("High win probability");
  else if (edgeScore.breakdown.probabilityScore < 60) weaknesses.push("Low win probability");

  if (edgeScore.breakdown.consensusScore >= 80) strengths.push("Strong consensus");
  else if (edgeScore.breakdown.consensusScore < 60) weaknesses.push("Weak consensus");

  if (edgeScore.breakdown.feasibilityScore >= 80) strengths.push("High feasibility");
  else if (edgeScore.breakdown.feasibilityScore < 60) weaknesses.push("Low feasibility");

  if (edgeScore.breakdown.riskScore >= 80) strengths.push("Good risk management");
  else if (edgeScore.breakdown.riskScore < 60) weaknesses.push("Poor risk management");

  return {
    score: edgeScore.score,
    grade: edgeScore.grade,
    actionability: edgeScore.actionability,
    recommendation: edgeScore.recommendation,
    confidence: edgeScore.confidence,
    strengths,
    weaknesses,
    keyMetrics: {
      ev: `${edgeScore.components.ev.toFixed(3)}`,
      probability: `${edgeScore.components.probability}%`,
      consensus: `${edgeScore.components.consensus}%`,
      feasibility: `${edgeScore.components.feasibility}/100`
    }
  };
}
