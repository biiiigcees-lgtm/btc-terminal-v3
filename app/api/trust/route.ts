// app/api/trust/route.ts — Trust Dashboard API with performance metrics

import { NextResponse } from "next/server";
import { getSignalHistory, calculatePerformanceStats, getAgentWeights } from "@/lib/signalLogger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get signal history for performance analysis
    const signals = getSignalHistory(500); // Last 500 signals for comprehensive stats
    
    // Calculate performance statistics
    const performanceStats = calculatePerformanceStats(signals);
    
    // Get current agent weights
    const agentWeights = getAgentWeights();
    
    // Calculate trust score based on multiple factors
    const trustScore = calculateTrustScore(performanceStats, agentWeights);
    
    // Calculate additional metrics
    const recentPerformance = calculateRecentPerformance(signals);
    const streakMetrics = calculateStreakMetrics(signals);
    const consistencyMetrics = calculateConsistencyMetrics(signals);
    
    // Format response
    const trustDashboard = {
      // Core metrics (always displayed)
      winRate: Math.round(performanceStats.winRate * 10) / 10,
      totalTrades: performanceStats.executedTrades,
      avgReturn: Math.round(performanceStats.avgProfit * 100) / 100,
      
      // Extended metrics
      totalPnL: Math.round(performanceStats.totalPnL * 100) / 100,
      sharpeRatio: Math.round(performanceStats.sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(performanceStats.maxDrawdown * 100) / 100,
      avgHoldDuration: Math.round(performanceStats.avgHoldDuration * 10) / 10,
      
      // Trust score (0-100)
      trustScore: Math.round(trustScore),
      trustLevel: getTrustLevel(trustScore),
      
      // Recent performance (last 20 trades)
      recent: {
        winRate: Math.round(recentPerformance.winRate * 10) / 10,
        avgReturn: Math.round(recentPerformance.avgReturn * 100) / 100,
        trades: recentPerformance.trades,
        pnl: Math.round(recentPerformance.pnl * 100) / 100
      },
      
      // Streak metrics
      streaks: {
        currentWinStreak: streakMetrics.currentWinStreak,
        currentLossStreak: streakMetrics.currentLossStreak,
        longestWinStreak: streakMetrics.longestWinStreak,
        longestLossStreak: streakMetrics.longestLossStreak
      },
      
      // Consistency metrics
      consistency: {
        winRateStability: Math.round(consistencyMetrics.winRateStability * 10) / 10,
        returnStability: Math.round(consistencyMetrics.returnStability * 10) / 10,
        predictability: Math.round(consistencyMetrics.predictability * 10) / 10
      },
      
      // Agent performance
      agentPerformance: performanceStats.performanceByAgent,
      
      // Directional performance
      directionalPerformance: performanceStats.accuracyByDirection,
      
      // Risk metrics
      risk: {
        riskAdjustedReturn: Math.round((performanceStats.avgProfit / (performanceStats.maxDrawdown || 1)) * 100) / 100,
        volatility: Math.round(calculateVolatility(signals) * 100) / 100,
        riskOfRuin: Math.round(calculateRiskOfRuin(performanceStats) * 100) / 100
      },
      
      // Status indicators
      status: {
        isProfitable: performanceStats.totalPnL > 0,
        isConsistent: consistencyMetrics.predictability > 60,
        isReliable: trustScore > 70,
        needsAttention: performanceStats.maxDrawdown > 15 || streakMetrics.currentLossStreak >= 5
      },
      
      timestamp: Date.now()
    };
    
    return NextResponse.json(trustDashboard, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Trust Dashboard API error:", err);
    return NextResponse.json({ error: "Trust data fetch failed" }, { status: 500 });
  }
}

// Calculate overall trust score (0-100)
function calculateTrustScore(
  performanceStats: any,
  agentWeights: any
): number {
  let score = 50; // Base score
  
  // Win rate contribution (30%)
  const winRateScore = Math.min(30, performanceStats.winRate * 0.3);
  score += winRateScore;
  
  // Profitability contribution (20%)
  const profitScore = performanceStats.totalPnL > 0 ? 
    Math.min(20, Math.abs(performanceStats.totalPnL) * 2) : -10;
  score += profitScore;
  
  // Consistency contribution (20%)
  const consistencyScore = calculateConsistencyScore(performanceStats);
  score += consistencyScore;
  
  // Risk management contribution (15%)
  const riskScore = performanceStats.maxDrawdown < 10 ? 15 : 
    performanceStats.maxDrawdown < 15 ? 5 : -5;
  score += riskScore;
  
  // Sample size contribution (15%)
  const sampleScore = Math.min(15, performanceStats.executedTrades * 0.1);
  score += sampleScore;
  
  return Math.max(0, Math.min(100, score));
}

// Get trust level based on score
function getTrustLevel(score: number): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 55) return "FAIR";
  return "POOR";
}

// Calculate recent performance (last 20 trades)
function calculateRecentPerformance(signals: any[]) {
  const recent = signals.slice(-20).filter(s => s.outcome !== "PENDING");
  
  if (recent.length === 0) {
    return { winRate: 0, avgReturn: 0, trades: 0, pnl: 0 };
  }
  
  const wins = recent.filter(s => s.outcome === "WIN");
  const totalPnL = recent.reduce((sum, s) => sum + (s.profitLoss || 0), 0);
  
  return {
    winRate: (wins.length / recent.length) * 100,
    avgReturn: totalPnL / recent.length,
    trades: recent.length,
    pnl: totalPnL
  };
}

// Calculate streak metrics
function calculateStreakMetrics(signals: any[]) {
  const completed = signals.filter(s => s.outcome !== "PENDING").slice(-50);
  
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;
  
  // Calculate current streaks
  for (let i = completed.length - 1; i >= 0; i--) {
    if (completed[i].outcome === "WIN") {
      if (currentLossStreak === 0) currentWinStreak++;
      else break;
    } else if (completed[i].outcome === "LOSS") {
      if (currentWinStreak === 0) currentLossStreak++;
      else break;
    }
  }
  
  // Calculate longest streaks
  completed.forEach(signal => {
    if (signal.outcome === "WIN") {
      tempWinStreak++;
      tempLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
    } else if (signal.outcome === "LOSS") {
      tempLossStreak++;
      tempWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
    }
  });
  
  return {
    currentWinStreak,
    currentLossStreak,
    longestWinStreak,
    longestLossStreak
  };
}

// Calculate consistency metrics
function calculateConsistencyMetrics(signals: any[]) {
  const completed = signals.filter(s => s.outcome !== "PENDING");
  
  if (completed.length < 10) {
    return { winRateStability: 0, returnStability: 0, predictability: 0 };
  }
  
  // Calculate win rate stability (rolling 10-trade windows)
  const winRates = [];
  for (let i = 9; i < completed.length; i++) {
    const window = completed.slice(i - 9, i + 1);
    const wins = window.filter(s => s.outcome === "WIN").length;
    winRates.push((wins / window.length) * 100);
  }
  
  const winRateStability = 100 - (calculateStandardDeviation(winRates) / 50 * 100);
  
  // Calculate return stability
  const returns = completed.map(s => s.profitLoss || 0);
  const returnStability = 100 - (calculateStandardDeviation(returns) / (Math.abs(returns.reduce((a, b) => a + b, 0)) / returns.length + 1) * 100);
  
  // Calculate predictability (correlation between confidence and outcomes)
  const predictability = calculatePredictability(completed);
  
  return {
    winRateStability: Math.max(0, winRateStability),
    returnStability: Math.max(0, returnStability),
    predictability: Math.max(0, predictability)
  };
}

// Calculate consistency score for trust score
function calculateConsistencyScore(performanceStats: any): number {
  let score = 0;
  
  // Sharpe ratio contribution
  if (performanceStats.sharpeRatio > 1.5) score += 10;
  else if (performanceStats.sharpeRatio > 1) score += 7;
  else if (performanceStats.sharpeRatio > 0.5) score += 4;
  
  // Drawdown contribution
  if (performanceStats.maxDrawdown < 5) score += 10;
  else if (performanceStats.maxDrawdown < 10) score += 5;
  
  return score;
}

// Calculate standard deviation
function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  
  return Math.sqrt(avgSquaredDiff);
}

// Calculate predictability (confidence vs outcome correlation)
function calculatePredictability(signals: any[]): number {
  const withConfidence = signals.filter(s => s.confidenceAccuracy !== null);
  
  if (withConfidence.length < 5) return 50;
  
  const avgConfidenceAccuracy = withConfidence.reduce((sum, s) => sum + s.confidenceAccuracy!, 0) / withConfidence.length;
  
  // Higher confidence accuracy = higher predictability
  return Math.max(0, 100 - avgConfidenceAccuracy);
}

// Calculate volatility
function calculateVolatility(signals: any[]): number {
  const returns = signals
    .filter(s => s.profitLoss !== null && s.outcome !== "PENDING")
    .map(s => s.profitLoss!);
  
  if (returns.length < 2) return 0;
  
  return calculateStandardDeviation(returns);
}

// Calculate risk of ruin
function calculateRiskOfRuin(performanceStats: any): number {
  const winRate = performanceStats.winRate / 100;
  const avgWin = Math.abs(performanceStats.avgProfit);
  const avgLoss = Math.abs(performanceStats.avgLoss);
  
  if (avgLoss === 0) return 0;
  
  // Simplified risk of ruin calculation
  const winLossRatio = avgWin / avgLoss;
  const riskOfRuin = Math.pow((1 - winRate) / winRate, winLossRatio);
  
  return Math.min(1, riskOfRuin) * 100;
}
