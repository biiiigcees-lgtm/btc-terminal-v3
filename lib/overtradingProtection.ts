// lib/overtradingProtection.ts — OVERTRADING PROTECTION: reduce confidence after 3 losses

export interface OvertradingMetrics {
  consecutiveLosses: number;
  recentLosses: number;        // Losses in last 10 trades
  tradeFrequency: number;     // Trades per hour
  avgTimeBetweenTrades: number; // Minutes
  rapidTradingCount: number;  // Trades < 15 minutes apart
  totalLosses: number;
  totalTrades: number;
  currentDrawdown: number;
  maxDrawdown: number;
  protectionLevel: "NONE" | "CAUTION" | "RESTRICT" | "BLOCK";
}

export interface ProtectionAdjustment {
  confidenceReduction: number;    // Percentage to reduce confidence
  evThresholdIncrease: number;    // How much to increase EV threshold
  probabilityPenalty: number;    // Probability percentage penalty
  tradingCooldown: number;        // Minutes to wait before next trade
  warnings: string[];
  recommendations: string[];
  protectionActive: boolean;
  protectionReason: string;
}

// Overtrading protection thresholds
const PROTECTION_THRESHOLDS = {
  consecutiveLosses: 3,          // Trigger after 3 consecutive losses
  recentLosses: 5,               // Trigger after 5 losses in last 10 trades
  maxTradeFrequency: 4,          // Max 4 trades per hour
  minTimeBetweenTrades: 15,       // Minimum 15 minutes between trades
  rapidTradingLimit: 3,          // Max 3 rapid trades (<15 min)
  maxDrawdown: 0.15,             // 15% max drawdown
  confidenceReductionPerLoss: 10, // 10% confidence reduction per loss
  evIncreasePerLoss: 0.005,      // 0.005 EV increase per loss
  maxConfidenceReduction: 40,     // Maximum 40% confidence reduction
  maxEVIncrease: 0.02            // Maximum 0.02 EV increase
};

// Calculate overtrading metrics
export function calculateOvertradingMetrics(
  recentTrades: Array<{
    timestamp: number;
    outcome: "WIN" | "LOSS" | "PENDING";
    profitLoss?: number;
  }>,
  currentDrawdown: number,
  maxDrawdown: number
): OvertradingMetrics {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const tenMinutesAgo = now - 600000;
  
  // Calculate consecutive losses
  let consecutiveLosses = 0;
  for (let i = recentTrades.length - 1; i >= 0; i--) {
    if (recentTrades[i].outcome === "LOSS") {
      consecutiveLosses++;
    } else if (recentTrades[i].outcome === "WIN") {
      break;
    }
  }
  
  // Calculate recent losses (last 10 trades)
  const lastTenTrades = recentTrades.slice(-10);
  const recentLosses = lastTenTrades.filter(t => t.outcome === "LOSS").length;
  
  // Calculate trade frequency
  const tradesInLastHour = recentTrades.filter(t => t.timestamp > oneHourAgo).length;
  const tradeFrequency = tradesInLastHour;
  
  // Calculate average time between trades
  let avgTimeBetweenTrades = 0;
  if (recentTrades.length > 1) {
    const timeDiffs: number[] = [];
    for (let i = 1; i < recentTrades.length; i++) {
      timeDiffs.push((recentTrades[i].timestamp - recentTrades[i-1].timestamp) / 60000); // Convert to minutes
    }
    avgTimeBetweenTrades = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
  }
  
  // Calculate rapid trading count
  const rapidTradingCount = recentTrades.filter((trade, index) => {
    if (index === 0) return false;
    const timeDiff = (trade.timestamp - recentTrades[index-1].timestamp) / 60000;
    return timeDiff < PROTECTION_THRESHOLDS.minTimeBetweenTrades;
  }).length;
  
  // Calculate total losses and trades
  const totalLosses = recentTrades.filter(t => t.outcome === "LOSS").length;
  const totalTrades = recentTrades.filter(t => t.outcome !== "PENDING").length;
  
  // Determine protection level
  let protectionLevel: "NONE" | "CAUTION" | "RESTRICT" | "BLOCK" = "NONE";
  
  if (consecutiveLosses >= PROTECTION_THRESHOLDS.consecutiveLosses && 
      recentLosses >= PROTECTION_THRESHOLDS.recentLosses) {
    protectionLevel = "BLOCK";
  } else if (consecutiveLosses >= PROTECTION_THRESHOLDS.consecutiveLosses) {
    protectionLevel = "RESTRICT";
  } else if (recentLosses >= PROTECTION_THRESHOLDS.recentLosses || 
             tradeFrequency > PROTECTION_THRESHOLDS.maxTradeFrequency ||
             rapidTradingCount >= PROTECTION_THRESHOLDS.rapidTradingLimit) {
    protectionLevel = "CAUTION";
  }
  
  return {
    consecutiveLosses,
    recentLosses,
    tradeFrequency,
    avgTimeBetweenTrades,
    rapidTradingCount,
    totalLosses,
    totalTrades,
    currentDrawdown,
    maxDrawdown,
    protectionLevel
  };
}

// Apply overtrading protection
export function applyOvertradingProtection(
  metrics: OvertradingMetrics,
  originalConfidence: number,
  originalEVThreshold: number = 0.06,
  originalProbability: number = 60
): ProtectionAdjustment {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let protectionActive = false;
  let protectionReason = "";
  
  // Calculate adjustments based on protection level
  let confidenceReduction = 0;
  let evThresholdIncrease = 0;
  let probabilityPenalty = 0;
  let tradingCooldown = 0;
  
  switch (metrics.protectionLevel) {
    case "BLOCK":
      protectionActive = true;
      protectionReason = "Severe overtrading detected - trading blocked";
      
      confidenceReduction = Math.min(
        PROTECTION_THRESHOLDS.maxConfidenceReduction,
        metrics.consecutiveLosses * PROTECTION_THRESHOLDS.confidenceReductionPerLoss
      );
      
      evThresholdIncrease = Math.min(
        PROTECTION_THRESHOLDS.maxEVIncrease,
        metrics.consecutiveLosses * PROTECTION_THRESHOLDS.evIncreasePerLoss
      );
      
      probabilityPenalty = metrics.consecutiveLosses * 5; // 5% per consecutive loss
      tradingCooldown = 60; // 1 hour cooldown
      
      warnings.push(`${metrics.consecutiveLosses} consecutive losses detected`);
      warnings.push(`${metrics.recentLosses} losses in last 10 trades`);
      warnings.push("Trading temporarily blocked to prevent further losses");
      
      recommendations.push("Take a break from trading");
      recommendations.push("Review strategy and risk management");
      recommendations.push("Wait for market conditions to improve");
      break;
      
    case "RESTRICT":
      protectionActive = true;
      protectionReason = "Overtrading pattern detected - trading restricted";
      
      confidenceReduction = Math.min(
        30,
        metrics.consecutiveLosses * PROTECTION_THRESHOLDS.confidenceReductionPerLoss
      );
      
      evThresholdIncrease = Math.min(
        0.015,
        metrics.consecutiveLosses * PROTECTION_THRESHOLDS.evIncreasePerLoss
      );
      
      probabilityPenalty = metrics.consecutiveLosses * 3; // 3% per consecutive loss
      tradingCooldown = 30; // 30 minute cooldown
      
      warnings.push(`${metrics.consecutiveLosses} consecutive losses detected`);
      if (metrics.tradeFrequency > PROTECTION_THRESHOLDS.maxTradeFrequency) {
        warnings.push(`High trading frequency: ${metrics.tradeFrequency} trades/hour`);
      }
      
      recommendations.push("Reduce position sizes");
      recommendations.push("Increase waiting time between trades");
      recommendations.push("Focus on higher quality setups");
      break;
      
    case "CAUTION":
      protectionActive = true;
      protectionReason = "Risk factors detected - trading caution advised";
      
      if (metrics.recentLosses >= PROTECTION_THRESHOLDS.recentLosses) {
        confidenceReduction = 15;
        probabilityPenalty = 5;
        tradingCooldown = 15;
        warnings.push(`High recent loss rate: ${metrics.recentLosses}/10 trades`);
      }
      
      if (metrics.tradeFrequency > PROTECTION_THRESHOLDS.maxTradeFrequency) {
        confidenceReduction += 10;
        evThresholdIncrease = 0.005;
        warnings.push(`Elevated trading frequency: ${metrics.tradeFrequency} trades/hour`);
      }
      
      if (metrics.rapidTradingCount >= PROTECTION_THRESHOLDS.rapidTradingLimit) {
        confidenceReduction += 10;
        probabilityPenalty += 3;
        warnings.push(`${metrics.rapidTradingCount} rapid trades detected`);
      }
      
      recommendations.push("Exercise extra caution with next trades");
      recommendations.push("Consider reducing trade frequency");
      recommendations.push("Focus on higher probability setups");
      break;
      
    case "NONE":
      protectionActive = false;
      protectionReason = "No overtrading protection needed";
      break;
  }
  
  // Additional drawdown protection
  if (metrics.currentDrawdown > PROTECTION_THRESHOLDS.maxDrawdown) {
    protectionActive = true;
    confidenceReduction += 20;
    probabilityPenalty += 10;
    warnings.push(`High drawdown: ${(metrics.currentDrawdown * 100).toFixed(1)}%`);
    recommendations.push("Reduce position sizes significantly");
    recommendations.push("Focus on capital preservation");
  }
  
  // Cap adjustments
  confidenceReduction = Math.min(confidenceReduction, PROTECTION_THRESHOLDS.maxConfidenceReduction);
  evThresholdIncrease = Math.min(evThresholdIncrease, PROTECTION_THRESHOLDS.maxEVIncrease);
  probabilityPenalty = Math.min(probabilityPenalty, 25); // Max 25% penalty
  
  return {
    confidenceReduction,
    evThresholdIncrease,
    probabilityPenalty,
    tradingCooldown,
    warnings,
    recommendations,
    protectionActive,
    protectionReason
  };
}

// Check if trading should be blocked
export function shouldBlockTrading(
  metrics: OvertradingMetrics,
  lastTradeTime: number
): {
  blocked: boolean;
  reason: string;
  blockUntil: number;
  timeRemaining: number;
} {
  const now = Date.now();
  
  if (metrics.protectionLevel === "BLOCK") {
    return {
      blocked: true,
      reason: "Trading blocked due to severe overtrading",
      blockUntil: lastTradeTime + 3600000, // 1 hour from last trade
      timeRemaining: Math.max(0, (lastTradeTime + 3600000) - now)
    };
  }
  
  if (metrics.protectionLevel === "RESTRICT" || metrics.protectionLevel === "CAUTION") {
    const cooldownMinutes = metrics.protectionLevel === "RESTRICT" ? 30 : 15;
    const blockUntil = lastTradeTime + (cooldownMinutes * 60000);
    
    if (now < blockUntil) {
      return {
        blocked: true,
        reason: `Trading cooldown active (${metrics.protectionLevel.toLowerCase()} level)`,
        blockUntil,
        timeRemaining: blockUntil - now
      };
    }
  }
  
  return {
    blocked: false,
    reason: "No trading block active",
    blockUntil: 0,
    timeRemaining: 0
  };
}

// Get overtrading protection status
export function getOvertradingProtectionStatus(
  metrics: OvertradingMetrics,
  adjustment: ProtectionAdjustment
): {
  status: "HEALTHY" | "CAUTION" | "RISKY" | "DANGER";
  message: string;
  color: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
} {
  if (metrics.protectionLevel === "BLOCK") {
    return {
      status: "DANGER",
      message: "Severe overtrading - trading blocked",
      color: "#ef4444", // red
      urgency: "CRITICAL"
    };
  }
  
  if (metrics.protectionLevel === "RESTRICT") {
    return {
      status: "RISKY",
      message: "Overtrading detected - trading restricted",
      color: "#f97316", // orange
      urgency: "HIGH"
    };
  }
  
  if (metrics.protectionLevel === "CAUTION") {
    return {
      status: "CAUTION",
      message: "Risk factors present - exercise caution",
      color: "#f59e0b", // amber
      urgency: "MEDIUM"
    };
  }
  
  return {
    status: "HEALTHY",
    message: "Trading patterns normal",
    color: "#10b981", // green
    urgency: "LOW"
  };
}

// Reset overtrading protection (for manual override)
export function resetOvertradingProtection(): {
  message: string;
  timestamp: number;
} {
  return {
    message: "Overtrading protection manually reset",
    timestamp: Date.now()
  };
}

// Get protection recommendations summary
export function getProtectionRecommendations(
  metrics: OvertradingMetrics,
  adjustment: ProtectionAdjustment
): {
  primary: string;
  secondary: string[];
  actions: string[];
} {
  let primary = "Continue normal trading";
  const secondary: string[] = [];
  const actions: string[] = [];
  
  if (adjustment.protectionActive) {
    primary = adjustment.protectionReason;
    secondary.push(...adjustment.warnings);
    actions.push(...adjustment.recommendations);
  }
  
  // Add metric-specific recommendations
  if (metrics.consecutiveLosses > 0) {
    secondary.push(`${metrics.consecutiveLosses} consecutive losses`);
    actions.push("Review recent trade performance");
  }
  
  if (metrics.tradeFrequency > 2) {
    secondary.push(`Trading frequency: ${metrics.tradeFrequency}/hour`);
    actions.push("Consider reducing trade frequency");
  }
  
  if (metrics.avgTimeBetweenTrades < 20 && metrics.avgTimeBetweenTrades > 0) {
    secondary.push(`Average time between trades: ${Math.round(metrics.avgTimeBetweenTrades)} minutes`);
    actions.push("Allow more time between trades");
  }
  
  return { primary, secondary, actions };
}
