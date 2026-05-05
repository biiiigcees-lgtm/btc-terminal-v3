// lib/reasonEngine.ts — REASON ENGINE showing WHY for every signal

export interface SignalReason {
  category: "MOMENTUM" | "VOLATILITY" | "CONSENSUS" | "RISK" | "TIMING" | "KALSHI" | "ALPHA" | "REGIME";
  reason: string;
  strength: "STRONG" | "MODERATE" | "WEAK";
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  details: string;
  confidence: number; // 0-100
}

export interface ReasonAnalysis {
  primaryReason: SignalReason;
  supportingReasons: SignalReason[];
  opposingReasons: SignalReason[];
  summary: string;
  confidence: number;
  recommendation: string;
  riskFactors: string[];
  opportunities: string[];
}

// Generate comprehensive reasons for a signal decision
export function generateSignalReasons(
  alpha: any,
  consensus: any,
  evAnalysis: any,
  indicators: any,
  market: any,
  filterResult: any
): ReasonAnalysis {
  const reasons: SignalReason[] = [];
  
  // Alpha-based reasons
  reasons.push(...generateAlphaReasons(alpha, indicators));
  
  // Consensus-based reasons
  reasons.push(...generateConsensusReasons(consensus));
  
  // EV-based reasons
  if (evAnalysis) {
    reasons.push(...generateEVReasons(evAnalysis));
  }
  
  // Momentum reasons
  reasons.push(...generateMomentumReasons(indicators, market));
  
  // Volatility reasons
  reasons.push(...generateVolatilityReasons(indicators, market));
  
  // Risk reasons
  reasons.push(...generateRiskReasons(evAnalysis, indicators, filterResult));
  
  // Timing reasons
  reasons.push(...generateTimingReasons(alpha, market));
  
  // Kalshi reasons (if applicable)
  reasons.push(...generateKalshiReasons(evAnalysis, market));
  
  // Regime reasons
  reasons.push(...generateRegimeReasons(alpha, market));
  
  // Categorize and rank reasons
  const primaryReason = selectPrimaryReason(reasons);
  const supportingReasons = getSupportingReasons(reasons, primaryReason);
  const opposingReasons = getOpposingReasons(reasons, primaryReason);
  
  // Generate summary and recommendation
  const summary = generateReasonSummary(primaryReason, supportingReasons, opposingReasons);
  const confidence = calculateReasonConfidence(primaryReason, supportingReasons);
  const recommendation = generateRecommendation(primaryReason, supportingReasons, opposingReasons);
  const riskFactors = extractRiskFactors(opposingReasons);
  const opportunities = extractOpportunities(supportingReasons);
  
  return {
    primaryReason,
    supportingReasons,
    opposingReasons,
    summary,
    confidence,
    recommendation,
    riskFactors,
    opportunities
  };
}

// Generate alpha-based reasons
function generateAlphaReasons(alpha: any, indicators: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  // Alpha score strength
  if (alpha.alphaScore > 85) {
    reasons.push({
      category: "ALPHA",
      reason: "Exceptional alpha score detected",
      strength: "STRONG",
      impact: "POSITIVE",
      details: `Alpha score of ${alpha.alphaScore} indicates strong directional bias`,
      confidence: 90
    });
  } else if (alpha.alphaScore > 70) {
    reasons.push({
      category: "ALPHA",
      reason: "Strong alpha score",
      strength: "MODERATE",
      impact: "POSITIVE",
      details: `Alpha score of ${alpha.alphaScore} shows good signal quality`,
      confidence: 75
    });
  } else if (alpha.alphaScore > 55) {
    reasons.push({
      category: "ALPHA",
      reason: "Moderate alpha score",
      strength: "WEAK",
      impact: "POSITIVE",
      details: `Alpha score of ${alpha.alphaScore} provides limited edge`,
      confidence: 60
    });
  }
  
  // Alpha direction confidence
  if (alpha.confidence > 80) {
    reasons.push({
      category: "ALPHA",
      reason: "High directional confidence",
      strength: "MODERATE",
      impact: "POSITIVE",
      details: `Directional confidence of ${alpha.confidence}% supports ${alpha.direction} bias`,
      confidence: alpha.confidence,
      evidence: `Directional confidence is above 80%, indicating a high level of confidence in the direction of the market.`
    });
  }
  
  return reasons;
}

// Generate detailed momentum evidence for WHY explanations
function generateMomentumEvidence(alpha: AlphaScoreResult, indicators: IndicatorResult): string[] {
  const evidence: string[] = [];
  
  evidence.push(`Alpha score: ${alpha.score.toFixed(3)}`);
  evidence.push(`Direction: ${alpha.direction}`);
  
  if (indicators.rsi) {
    evidence.push(`RSI momentum: ${indicators.rsi.toFixed(1)}`);
  }
  
  if (indicators.macd) {
    evidence.push(`MACD trend: ${indicators.macd.histogram > 0 ? 'bullish' : 'bearish'}`);
  }
  
  if (indicators.bb) {
    evidence.push(`Bollinger position: ${indicators.bb.position > 0.5 ? 'upper band' : 'lower band'}`);
  }
  
  return evidence;
}

// Generate detailed consensus evidence for WHY explanations
function generateConsensusEvidence(consensus: ConsensusResult): string[] {
  const evidence: string[] = [];
  
  evidence.push(`Agreement: ${consensus.agreement}%`);
  evidence.push(`Dissent: ${consensus.dissentLevel}%`);
  
  if (consensus.primarySignal) {
    evidence.push(`Primary signal: ${consensus.primarySignal.direction} (${consensus.primarySignal.confidence}% confidence)`);
  }
  
  if (consensus.secondarySignals && consensus.secondarySignals.length > 0) {
    const supportingCount = consensus.secondarySignals.filter(s => s.direction === consensus.direction).length;
    evidence.push(`Supporting signals: ${supportingCount}/${consensus.secondarySignals.length}`);
  }
  
  return evidence;
}

// Generate consensus-based reasons
function generateConsensusReasons(consensus: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  // Agent agreement
  if (consensus.agreement > 80) {
    reasons.push({
      category: "CONSENSUS",
      reason: "Strong multi-agent agreement",
      strength: "STRONG",
      impact: "POSITIVE",
      details: `${consensus.agreement}% of agents agree on ${consensus.direction} direction`,
      confidence: consensus.agreement,
      evidence: `Agent agreement is above 80%, indicating a strong level of consensus among agents.`
    });
  } else if (consensus.agreement > 60) {
    reasons.push({
      category: "CONSENSUS",
      reason: "Good agent consensus",
      strength: "MODERATE",
      impact: "POSITIVE",
      details: `${consensus.agreement}% agent agreement provides validation`,
      confidence: consensus.agreement,
      evidence: `Agent agreement is above 60%, indicating a moderate level of consensus among agents.`
    });
  } else if (consensus.agreement < 40) {
    reasons.push({
      category: "CONSENSUS",
      reason: "Low agent agreement",
      strength: "WEAK",
      impact: "NEGATIVE",
      details: `Only ${consensus.agreement}% agent agreement indicates uncertainty`,
      confidence: 100 - consensus.agreement
    });
  }
  
  // Consensus strength
  if (consensus.strength > 75) {
    reasons.push({
      category: "CONSENSUS",
      reason: "Powerful consensus signal",
      strength: "STRONG",
      impact: "POSITIVE",
      details: `Consensus strength of ${consensus.strength} shows conviction`,
      confidence: consensus.strength
    });
  }
  
  return reasons;
}

// Generate EV-based reasons
function generateEVReasons(evAnalysis: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  if (!evAnalysis) return reasons;
  
  const ev = evAnalysis.ev.ev;
  
  // EV magnitude
  if (ev > 0.1) {
    reasons.push({
      category: "RISK",
      reason: "Exceptional expected value",
      strength: "STRONG",
      impact: "POSITIVE",
      details: `EV of ${ev.toFixed(3)} indicates highly profitable opportunity`,
      confidence: 95
    });
  } else if (ev > 0.05) {
    reasons.push({
      category: "RISK",
      reason: "Strong expected value",
      strength: "MODERATE",
      impact: "POSITIVE",
      details: `EV of ${ev.toFixed(3)} provides good profit potential`,
      confidence: 80
    });
  } else if (ev > 0.02) {
    reasons.push({
      category: "RISK",
      reason: "Positive expected value",
      strength: "WEAK",
      impact: "POSITIVE",
      details: `EV of ${ev.toFixed(3)} offers modest edge`,
      confidence: 65
    });
  } else if (ev <= 0) {
    reasons.push({
      category: "RISK",
      reason: "Negative or zero expected value",
      strength: "STRONG",
      impact: "NEGATIVE",
      details: `EV of ${ev.toFixed(3)} indicates unfavorable risk/reward`,
      confidence: 90
    });
  }
  
  // Risk-adjusted EV
  const riskAdjEV = evAnalysis.riskAdjustedEV;
  if (riskAdjEV > ev * 0.8) {
    reasons.push({
      category: "RISK",
      reason: "Good risk-adjusted returns",
      strength: "MODERATE",
      impact: "POSITIVE",
      details: `Risk-adjusted EV of ${riskAdjEV.toFixed(3)} shows quality setup`,
      confidence: 75
    });
  }
  
  return reasons;
}

// Generate momentum reasons
function generateMomentumReasons(indicators: any, market: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  // EMA alignment
  const { ema9, ema21, ema50, price } = indicators;
  const currentPrice = market.price;
  
  if (ema9 > ema21 && ema21 > ema50 && currentPrice > ema9) {
    reasons.push({
      category: "MOMENTUM",
      reason: "Strong bullish momentum",
      strength: "STRONG",
      impact: "POSITIVE",
      details: "All EMAs aligned bullish with price above 9-EMA",
      confidence: 85
    });
  } else if (ema9 < ema21 && ema21 < ema50 && currentPrice < ema9) {
    reasons.push({
      category: "MOMENTUM",
      reason: "Strong bearish momentum",
      strength: "STRONG",
      impact: "NEGATIVE",
      details: "All EMAs aligned bearish with price below 9-EMA",
      confidence: 85
    });
  }
  
  // RSI momentum
  const { rsi } = indicators;
  if (rsi > 60 && rsi < 80) {
    reasons.push({
      category: "MOMENTUM",
      reason: "Bullish RSI momentum",
      strength: "MODERATE",
      impact: "POSITIVE",
      details: `RSI at ${rsi.toFixed(1)} shows upward momentum without overextension`,
      confidence: 70
    });
  } else if (rsi < 40 && rsi > 20) {
    reasons.push({
      category: "MOMENTUM",
      reason: "Bearish RSI momentum",
      strength: "MODERATE",
      impact: "NEGATIVE",
      details: `RSI at ${rsi.toFixed(1)} shows downward momentum without oversold`,
      confidence: 70
    });
  }
  
  return reasons;
}

// Generate volatility reasons
function generateVolatilityReasons(indicators: any, market: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  const { atr, bbUpper, bbMid, bbLower } = indicators;
  const price = market.price;
  const volatility = (atr / price) * 100;
  
  // Volatility regime
  if (volatility > 3) {
    reasons.push({
      category: "VOLATILITY",
      reason: "High volatility environment",
      strength: "MODERATE",
      impact: "NEGATIVE",
      details: `Volatility at ${volatility.toFixed(2)}% increases risk`,
      confidence: 75
    });
  } else if (volatility < 1) {
    reasons.push({
      category: "VOLATILITY",
      reason: "Low volatility environment",
      strength: "WEAK",
      impact: "POSITIVE",
      details: `Volatility at ${volatility.toFixed(2)}% provides stability`,
      confidence: 65
    });
  }
  
  // Bollinger Band position
  if (price > bbUpper) {
    reasons.push({
      category: "VOLATILITY",
      reason: "Price above upper Bollinger Band",
      strength: "MODERATE",
      impact: "NEGATIVE",
      details: "Price extended beyond normal volatility range",
      confidence: 70
    });
  } else if (price < bbLower) {
    reasons.push({
      category: "VOLATILITY",
      reason: "Price below lower Bollinger Band",
      strength: "MODERATE",
      impact: "POSITIVE",
      details: "Price oversold beyond normal volatility range",
      confidence: 70
    });
  }
  
  return reasons;
}

// Generate risk reasons
function generateRiskReasons(evAnalysis: any, indicators: any, filterResult: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  // Filter-based risk factors
  if (filterResult && filterResult.blockedBy.length > 0) {
    filterResult.blockedBy.forEach((reason: string) => {
      reasons.push({
        category: "RISK",
        reason: `Risk filter: ${reason}`,
        strength: "STRONG",
        impact: "NEGATIVE",
        details: reason,
        confidence: 85
      });
    });
  }
  
  // Kelly fraction risk
  if (evAnalysis && evAnalysis.kellyFraction) {
    const kelly = evAnalysis.kellyFraction;
    if (kelly > 0.25) {
      reasons.push({
        category: "RISK",
        reason: "High Kelly fraction suggests risk",
        strength: "MODERATE",
        impact: "NEGATIVE",
        details: `Kelly fraction of ${kelly.toFixed(3)} indicates aggressive position`,
        confidence: 70
      });
    } else if (kelly < 0.05) {
      reasons.push({
        category: "RISK",
        reason: "Low Kelly fraction indicates weak edge",
        strength: "WEAK",
        impact: "NEGATIVE",
        details: `Kelly fraction of ${kelly.toFixed(3)} suggests limited opportunity`,
        confidence: 60
      });
    }
  }
  
  return reasons;
}

// Generate timing reasons
function generateTimingReasons(alpha: any, market: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  // Regime timing
  if (alpha.regime && alpha.regime.expectedDuration) {
    const duration = alpha.regime.expectedDuration;
    if (duration > 60) {
      reasons.push({
        category: "TIMING",
        reason: "Long regime duration expected",
        strength: "WEAK",
        impact: "POSITIVE",
        details: `${duration} minutes expected for ${alpha.regime.regime} regime`,
        confidence: 60
      });
    } else if (duration < 15) {
      reasons.push({
        category: "TIMING",
        reason: "Short regime window",
        strength: "MODERATE",
        impact: "NEGATIVE",
        details: `Only ${duration} minutes expected for current regime`,
        confidence: 70
      });
    }
  }
  
  return reasons;
}

// Generate Kalshi reasons
function generateKalshiReasons(evAnalysis: any, market: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  // Kalshi edge (if available)
  if (evAnalysis && evAnalysis.kalshiEdge) {
    const edge = evAnalysis.kalshiEdge;
    if (edge > 10) {
      reasons.push({
        category: "KALSHI",
        reason: "Strong Kalshi market edge",
        strength: "MODERATE",
        impact: "POSITIVE",
        details: `Kalshi edge of ${edge.toFixed(1)}% supports directional bias`,
        confidence: 75
      });
    }
  }
  
  return reasons;
}

// Generate regime reasons
function generateRegimeReasons(alpha: any, market: any): SignalReason[] {
  const reasons: SignalReason[] = [];
  
  if (alpha.regime) {
    const regime = alpha.regime.regime;
    const strength = alpha.regime.regimeStrength;
    
    if (regime === "TREND" && strength > 70) {
      reasons.push({
        category: "REGIME",
        reason: "Strong trending regime",
        strength: "MODERATE",
        impact: "POSITIVE",
        details: `Trend regime with ${strength}% strength favors directional trades`,
        confidence: strength
      });
    } else if (regime === "RANGE" && strength > 70) {
      reasons.push({
        category: "REGIME",
        reason: "Strong range-bound regime",
        strength: "WEAK",
        impact: "NEGATIVE",
        details: `Range regime with ${strength}% strength limits directional opportunities`,
        confidence: strength
      });
    }
  }
  
  return reasons;
}

// Select primary reason (strongest positive or negative)
function selectPrimaryReason(reasons: SignalReason[]): SignalReason {
  // Prioritize STRONG > MODERATE > WEAK
  // Then POSITIVE > NEGATIVE > NEUTRAL
  // Then by confidence
  
  const sorted = [...reasons].sort((a, b) => {
    // Sort by strength
    const strengthOrder = { "STRONG": 3, "MODERATE": 2, "WEAK": 1 };
    const strengthDiff = strengthOrder[b.strength] - strengthOrder[a.strength];
    if (strengthDiff !== 0) return strengthDiff;
    
    // Sort by impact (positive first for trades, negative first for no-trades)
    const impactOrder = { "POSITIVE": 3, "NEGATIVE": 2, "NEUTRAL": 1 };
    const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
    if (impactDiff !== 0) return impactDiff;
    
    // Sort by confidence
    return b.confidence - a.confidence;
  });
  
  return sorted[0] || {
    category: "ALPHA",
    reason: "No clear signal detected",
    strength: "WEAK",
    impact: "NEUTRAL",
    details: "Insufficient data for clear recommendation",
    confidence: 0
  };
}

// Get supporting reasons (same impact as primary)
function getSupportingReasons(reasons: SignalReason[], primary: SignalReason): SignalReason[] {
  return reasons
    .filter(r => r !== primary && r.impact === primary.impact)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// Get opposing reasons (opposite impact to primary)
function getOpposingReasons(reasons: SignalReason[], primary: SignalReason): SignalReason[] {
  const oppositeImpact = primary.impact === "POSITIVE" ? "NEGATIVE" : "POSITIVE";
  return reasons
    .filter(r => r.impact === oppositeImpact)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);
}

// Generate reason summary
function generateReasonSummary(primary: SignalReason, supporting: SignalReason[], opposing: SignalReason[]): string {
  if (primary.impact === "POSITIVE") {
    const supportText = supporting.length > 0 ? 
      ` Supported by ${supporting.map(r => r.reason).join(", ")}.` : "";
    const opposeText = opposing.length > 0 ? 
      ` Despite concerns about ${opposing.map(r => r.reason).join(", ")}.` : "";
    
    return `${primary.reason}.${supportText}${opposeText}`;
  } else {
    const opposeText = opposing.length > 0 ? 
      ` ${opposing.map(r => r.reason).join(" and ")} outweigh benefits.` : "";
    const supportText = supporting.length > 0 ? 
      ` Limited by ${supporting.map(r => r.reason).join(", ")}.` : "";
    
    return `${primary.reason}.${opposeText}${supportText}`;
  }
}

// Calculate reason confidence
function calculateReasonConfidence(primary: SignalReason, supporting: SignalReason[]): number {
  const weights = {
    "STRONG": 1.0,
    "MODERATE": 0.7,
    "WEAK": 0.4
  };
  
  const primaryWeight = weights[primary.strength] * primary.confidence;
  const supportingWeight = supporting.reduce((sum, r) => 
    sum + (weights[r.strength] * r.confidence), 0);
  
  const totalWeight = primaryWeight + (supportingWeight / supporting.length);
  
  return Math.min(100, Math.round(totalWeight));
}

// Generate recommendation
function generateRecommendation(primary: SignalReason, supporting: SignalReason[], opposing: SignalReason[]): string {
  if (primary.impact === "POSITIVE" && primary.strength === "STRONG") {
    return "EXECUTE TRADE - Strong signal with supporting evidence";
  } else if (primary.impact === "POSITIVE" && primary.strength === "MODERATE") {
    return "CONSIDER TRADE - Good signal with some supporting factors";
  } else if (primary.impact === "NEGATIVE" && primary.strength === "STRONG") {
    return "AVOID TRADE - Strong warning signs detected";
  } else if (primary.impact === "NEGATIVE" && primary.strength === "MODERATE") {
    return "WAIT FOR BETTER SETUP - Moderate concerns present";
  } else {
    return "NEUTRAL - Insufficient signal strength";
  }
}

// Extract risk factors
function extractRiskFactors(opposing: SignalReason[]): string[] {
  return opposing.map(r => r.reason);
}

// Extract opportunities
function extractOpportunities(supporting: SignalReason[]): string[] {
  return supporting.map(r => r.reason);
}
