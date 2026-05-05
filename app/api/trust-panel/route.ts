// app/api/trust-panel/route.ts — TRUST PANEL with Win Rate, Total Trades, Avg EV

import { NextResponse } from "next/server";
import { getSignalHistory, calculatePerformanceStats } from "@/lib/signalLogger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get signal history for trust analysis
    const signals = getSignalHistory(100); // Last 100 signals for comprehensive stats
    
    // Calculate core trust metrics
    const trustMetrics = calculateTrustMetrics(signals);
    
    // Calculate recent performance (last 20 trades)
    const recentMetrics = calculateRecentMetrics(signals.slice(-20));
    
    // Get trust level and status
    const trustLevel = getTrustLevel(trustMetrics.overallScore);
    const trustStatus = getTrustStatus(trustMetrics, recentMetrics);
    
    // Get last trade result
    const lastTrade = getLastTradeResult(signals);
    
    // Create trust panel response
    const trustPanel = {
      // Core metrics (always visible) - Final God Tier Lock focus
      winRate: Math.round(trustMetrics.winRate * 10) / 10,
      totalTrades: trustMetrics.totalTrades,
      avgEV: Math.round(trustMetrics.avgEV * 1000) / 1000,
      lastTradeResult: lastTrade,
      
      // Trust scoring
      overallScore: Math.round(trustMetrics.overallScore),
      trustLevel,
      trustStatus,
      
      // Performance metrics
      totalPnL: Math.round(trustMetrics.totalPnL * 100) / 100,
      sharpeRatio: Math.round(trustMetrics.sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(trustMetrics.maxDrawdown * 100) / 100,
      avgReturn: Math.round(trustMetrics.avgReturn * 100) / 100,
      
      // Recent performance
      recent: {
        winRate: Math.round(recentMetrics.winRate * 10) / 10,
        trades: recentMetrics.trades,
        avgEV: Math.round(recentMetrics.avgEV * 1000) / 1000,
        pnl: Math.round(recentMetrics.pnl * 100) / 100
      },
      
      // Trust indicators
      indicators: {
        isProfitable: trustMetrics.totalPnL > 0,
        isConsistent: trustMetrics.consistencyScore > 60,
        isReliable: trustMetrics.overallScore > 70,
        trendingUp: recentMetrics.winRate > trustMetrics.winRate,
        needsAttention: trustMetrics.maxDrawdown > 15 || trustMetrics.consecutiveLosses >= 3
      },
      
      // Trade quality breakdown
      quality: {
        highEdgeTrades: trustMetrics.highEdgeTrades,
        mediumEdgeTrades: trustMetrics.mediumEdgeTrades,
        lowEdgeTrades: trustMetrics.lowEdgeTrades,
        noTradeSignals: trustMetrics.noTradeSignals
      },
      
      // Risk metrics
      risk: {
        riskAdjustedReturn: Math.round(trustMetrics.riskAdjustedReturn * 100) / 100,
        volatility: Math.round(trustMetrics.volatility * 100) / 100,
        riskOfRuin: Math.round(trustMetrics.riskOfRuin * 100) / 100,
        kellyAvg: Math.round(trustMetrics.avgKelly * 1000) / 1000
      },
      
      // Streak information
      streaks: {
        currentWinStreak: trustMetrics.currentWinStreak,
        currentLossStreak: trustMetrics.currentLossStreak,
        longestWinStreak: trustMetrics.longestWinStreak,
        longestLossStreak: trustMetrics.longestLossStreak
      },
      
      // Time-based metrics
      timeMetrics: {
        avgHoldDuration: Math.round(trustMetrics.avgHoldDuration * 10) / 10,
        tradesPerDay: Math.round(trustMetrics.tradesPerDay * 10) / 10,
        lastTradeTime: trustMetrics.lastTradeTime,
        hoursSinceLastTrade: Math.round(trustMetrics.hoursSinceLastTrade * 10) / 10
      },
      
      timestamp: Date.now()
    };
    
    return NextResponse.json(trustPanel, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Trust Panel API error:", err);
    return NextResponse.json({ error: "Trust data fetch failed" }, { status: 500 });
  }
}

// Calculate comprehensive trust metrics
function calculateTrustMetrics(signals: any[]) {
  const executedTrades = signals.filter(s => s.tradeExecuted && s.outcome !== "PENDING");
  const completedTrades = executedTrades.filter(s => s.outcome !== "PENDING");
  
  // Basic metrics
  const totalTrades = executedTrades.length;
  const wins = completedTrades.filter(s => s.outcome === "WIN").length;
  const winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
  
  // EV metrics
  const evValues = executedTrades.map(s => s.ev || 0);
  const avgEV = evValues.length > 0 ? evValues.reduce((sum, ev) => sum + ev, 0) / evValues.length : 0;
  
  // P&L metrics
  const pnlValues = completedTrades.map(s => s.profitLoss || 0);
  const totalPnL = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
  const avgReturn = completedTrades.length > 0 ? totalPnL / completedTrades.length : 0;
  
  // Risk metrics
  const maxDrawdown = calculateMaxDrawdown(pnlValues);
  const sharpeRatio = calculateSharpeRatio(pnlValues);
  const volatility = calculateVolatility(pnlValues);
  const riskOfRuin = calculateRiskOfRuin(winRate / 100, avgReturn, volatility);
  const riskAdjustedReturn = volatility > 0 ? avgReturn / volatility : 0;
  
  // Kelly metrics
  const kellyValues = executedTrades.map(s => s.kellyFraction || 0);
  const avgKelly = kellyValues.length > 0 ? kellyValues.reduce((sum, k) => sum + k, 0) / kellyValues.length : 0;
  
  // Consistency score
  const consistencyScore = calculateConsistencyScore(completedTrades);
  
  // Overall trust score (0-100)
  const overallScore = calculateOverallTrustScore({
    winRate,
    totalTrades,
    avgEV,
    sharpeRatio,
    maxDrawdown,
    consistencyScore,
    riskAdjustedReturn
  });
  
  // Trade quality breakdown
  const highEdgeTrades = executedTrades.filter(s => s.ev > 0.05).length;
  const mediumEdgeTrades = executedTrades.filter(s => s.ev > 0.02 && s.ev <= 0.05).length;
  const lowEdgeTrades = executedTrades.filter(s => s.ev > 0 && s.ev <= 0.02).length;
  const noTradeSignals = signals.filter(s => s.direction === "WAIT").length;
  
  // Streak metrics
  const streaks = calculateStreaks(completedTrades);
  
  // Time metrics
  const now = Date.now();
  const holdDurations = completedTrades.map(s => s.holdDuration || 0);
  const avgHoldDuration = holdDurations.length > 0 ? holdDurations.reduce((sum, d) => sum + d, 0) / holdDurations.length : 0;
  
  const lastTrade = completedTrades[completedTrades.length - 1];
  const lastTradeTime = lastTrade?.timestamp || 0;
  const hoursSinceLastTrade = lastTradeTime > 0 ? (now - lastTradeTime) / (1000 * 60 * 60) : Infinity;
  
  const daysSinceFirst = signals.length > 0 ? (now - signals[0].timestamp) / (1000 * 60 * 60 * 24) : 1;
  const tradesPerDay = totalTrades / daysSinceFirst;
  
  return {
    winRate,
    totalTrades,
    avgEV,
    totalPnL,
    sharpeRatio,
    maxDrawdown,
    avgReturn,
    volatility,
    riskOfRuin,
    riskAdjustedReturn,
    avgKelly,
    consistencyScore,
    overallScore,
    highEdgeTrades,
    mediumEdgeTrades,
    lowEdgeTrades,
    noTradeSignals,
    ...streaks,
    avgHoldDuration,
    lastTradeTime,
    hoursSinceLastTrade,
    tradesPerDay
  };
}

// Calculate recent metrics (last N trades)
function calculateRecentMetrics(recentSignals: any[]) {
  const executedTrades = recentSignals.filter(s => s.tradeExecuted && s.outcome !== "PENDING");
  const completedTrades = executedTrades.filter(s => s.outcome !== "PENDING");
  
  const totalTrades = executedTrades.length;
  const wins = completedTrades.filter(s => s.outcome === "WIN").length;
  const winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
  
  const evValues = executedTrades.map(s => s.ev || 0);
  const avgEV = evValues.length > 0 ? evValues.reduce((sum, ev) => sum + ev, 0) / evValues.length : 0;
  
  const pnlValues = completedTrades.map(s => s.profitLoss || 0);
  const pnl = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
  
  return {
    winRate,
    trades: totalTrades,
    avgEV,
    pnl
  };
}

// Calculate maximum drawdown
function calculateMaxDrawdown(pnlValues: number[]): number {
  if (pnlValues.length < 2) return 0;
  
  let maxDrawdown = 0;
  let peak = pnlValues[0];
  let cumulativePnL = 0;
  
  for (const pnl of pnlValues) {
    cumulativePnL += pnl;
    if (cumulativePnL > peak) {
      peak = cumulativePnL;
    }
    const drawdown = peak - cumulativePnL;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

// Calculate Sharpe ratio
function calculateSharpeRatio(pnlValues: number[]): number {
  if (pnlValues.length < 2) return 0;
  
  const returns = pnlValues;
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev > 0 ? avgReturn / stdDev : 0;
}

// Calculate volatility
function calculateVolatility(pnlValues: number[]): number {
  if (pnlValues.length < 2) return 0;
  
  const returns = pnlValues;
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

// Calculate risk of ruin
function calculateRiskOfRuin(winRate: number, avgReturn: number, volatility: number): number {
  if (volatility === 0) return 0;
  
  const z = (avgReturn / volatility) * Math.sqrt(winRate * (1 - winRate));
  const riskOfRuin = 1 / (1 + Math.exp(z));
  
  return Math.max(0, Math.min(1, riskOfRuin)) * 100;
}

// Calculate consistency score
function calculateConsistencyScore(trades: any[]): number {
  if (trades.length < 10) return 50;
  
  // Calculate rolling win rates
  const windowSize = 10;
  const winRates = [];
  
  for (let i = windowSize; i <= trades.length; i++) {
    const window = trades.slice(i - windowSize, i);
    const wins = window.filter(t => t.outcome === "WIN").length;
    winRates.push((wins / windowSize) * 100);
  }
  
  if (winRates.length === 0) return 50;
  
  const avgWinRate = winRates.reduce((sum, wr) => sum + wr, 0) / winRates.length;
  const winRateStdDev = Math.sqrt(
    winRates.reduce((sum, wr) => sum + Math.pow(wr - avgWinRate, 2), 0) / winRates.length
  );
  
  // Lower standard deviation = higher consistency
  const consistencyScore = Math.max(0, 100 - winRateStdDev);
  
  return Math.round(consistencyScore);
}

// Calculate overall trust score
function calculateOverallTrustScore(metrics: any): number {
  let score = 50; // Base score
  
  // Win rate contribution (25%)
  if (metrics.winRate > 60) score += 25;
  else if (metrics.winRate > 55) score += 20;
  else if (metrics.winRate > 50) score += 10;
  else score -= 10;
  
  // Trade count contribution (15%)
  if (metrics.totalTrades > 50) score += 15;
  else if (metrics.totalTrades > 20) score += 10;
  else if (metrics.totalTrades > 10) score += 5;
  
  // EV contribution (20%)
  if (metrics.avgEV > 0.05) score += 20;
  else if (metrics.avgEV > 0.02) score += 15;
  else if (metrics.avgEV > 0.01) score += 10;
  else if (metrics.avgEV <= 0) score -= 15;
  
  // Sharpe ratio contribution (15%)
  if (metrics.sharpeRatio > 1.5) score += 15;
  else if (metrics.sharpeRatio > 1.0) score += 10;
  else if (metrics.sharpeRatio > 0.5) score += 5;
  else if (metrics.sharpeRatio < 0) score -= 10;
  
  // Drawdown penalty (10%)
  if (metrics.maxDrawdown < 5) score += 10;
  else if (metrics.maxDrawdown < 10) score += 5;
  else if (metrics.maxDrawdown > 20) score -= 10;
  
  // Consistency contribution (15%)
  score += (metrics.consistencyScore - 50) * 0.3;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Calculate streak metrics
function calculateStreaks(trades: any[]) {
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;
  
  // Calculate current streaks
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].outcome === "WIN") {
      if (currentLossStreak === 0) currentWinStreak++;
      else break;
    } else if (trades[i].outcome === "LOSS") {
      if (currentWinStreak === 0) currentLossStreak++;
      else break;
    }
  }
  
  // Calculate longest streaks
  trades.forEach(trade => {
    if (trade.outcome === "WIN") {
      tempWinStreak++;
      tempLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
    } else if (trade.outcome === "LOSS") {
      tempLossStreak++;
      tempWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
    }
  });
  
  return {
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    longestLossStreak,
    consecutiveLosses: currentLossStreak
  };
}

// Get last trade result
function getLastTradeResult(signals: any[]): {
  result: "WIN" | "LOSS" | "PENDING" | "NONE";
  profitLoss: number | null;
  direction: string;
  timestamp: number;
  timeAgo: string;
  ev: number;
} {
  const executedTrades = signals.filter(s => s.tradeExecuted);
  
  if (executedTrades.length === 0) {
    return {
      result: "NONE",
      profitLoss: null,
      direction: "WAIT",
      timestamp: 0,
      timeAgo: "No trades yet",
      ev: 0
    };
  }
  
  const lastTrade = executedTrades[executedTrades.length - 1];
  const now = Date.now();
  const timeDiff = now - lastTrade.timestamp;
  
  let timeAgo: string;
  if (timeDiff < 60000) timeAgo = "Just now";
  else if (timeDiff < 3600000) timeAgo = `${Math.floor(timeDiff / 60000)}m ago`;
  else if (timeDiff < 86400000) timeAgo = `${Math.floor(timeDiff / 3600000)}h ago`;
  else timeAgo = `${Math.floor(timeDiff / 86400000)}d ago`;
  
  return {
    result: lastTrade.outcome || "PENDING",
    profitLoss: lastTrade.profitLoss || null,
    direction: lastTrade.direction || "WAIT",
    timestamp: lastTrade.timestamp,
    timeAgo,
    ev: lastTrade.ev || 0
  };
}

// Get trust level
function getTrustLevel(score: number): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 55) return "FAIR";
  return "POOR";
}

// Get trust status
function getTrustStatus(metrics: any, recent: any): string {
  if (metrics.indicators?.needsAttention) {
    return "NEEDS ATTENTION";
  }
  
  if (recent.winRate > metrics.winRate + 5) {
    return "IMPROVING";
  }
  
  if (recent.winRate < metrics.winRate - 10) {
    return "DECLINING";
  }
  
  if (metrics.overallScore > 80) {
    return "EXCELLENT";
  }
  
  if (metrics.overallScore > 65) {
    return "STABLE";
  }
  
  return "CAUTION";
}
