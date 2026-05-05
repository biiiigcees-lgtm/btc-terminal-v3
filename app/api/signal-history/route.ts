// app/api/signal-history/route.ts — SIGNAL HISTORY showing last 20 with direction, EV, result

import { NextResponse } from "next/server";
import { getSignalHistory } from "@/lib/signalLogger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const outcome = url.searchParams.get("outcome") as "WIN" | "LOSS" | "PENDING" | "CANCELLED" | undefined;
    const direction = url.searchParams.get("direction") as "ABOVE" | "BELOW" | "WAIT" | undefined;
    
    // Get signal history
    const signals = getSignalHistory(limit, undefined, outcome);
    
    // Filter by direction if specified
    let filteredSignals = signals;
    if (direction && direction !== "ALL") {
      filteredSignals = signals.filter(s => s.direction === direction);
    }
    
    // Format signals for display (last 20 focus)
    const formattedSignals = filteredSignals.slice(0, 20).map(signal => ({
      id: signal.id,
      timestamp: signal.timestamp,
      direction: signal.direction,
      ev: Math.round(signal.ev * 1000) / 1000,
      probability: signal.probability,
      confidence: signal.confidence,
      outcome: signal.outcome,
      profitLoss: signal.profitLoss ? Math.round(signal.profitLoss * 100) / 100 : null,
      result: getResultDisplay(signal.outcome, signal.profitLoss),
      evClass: getEVClassification(signal.ev),
      confidenceLevel: getConfidenceLevel(signal.confidence),
      tradeExecuted: signal.tradeExecuted,
      alphaScore: signal.alphaScore,
      consensusStrength: signal.consensusStrength,
      // Time formatting
      time: new Date(signal.timestamp).toLocaleTimeString(),
      date: new Date(signal.timestamp).toLocaleDateString(),
      relativeTime: getRelativeTime(signal.timestamp),
      // Visual indicators
      resultColor: getResultColor(signal.outcome),
      evColor: getEVColor(signal.ev),
      directionIcon: getDirectionIcon(signal.direction)
    }));
    
    // Calculate summary statistics
    const summary = calculateHistorySummary(formattedSignals);
    
    // Get performance trends
    const trends = calculateHistoryTrends(formattedSignals);
    
    return NextResponse.json({
      signals: formattedSignals,
      summary,
      trends,
      filters: {
        limit,
        outcome,
        direction,
        totalAvailable: signals.length,
        displayed: formattedSignals.length
      },
      timestamp: Date.now()
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Signal History API error:", err);
    return NextResponse.json({ error: "Signal history fetch failed" }, { status: 500 });
  }
}

// Get result display text and styling
function getResultDisplay(outcome: string, profitLoss: number | null): {
  text: string;
  subtext: string;
  icon: string;
} {
  switch (outcome) {
    case "WIN":
      return {
        text: "WIN",
        subtext: profitLoss ? `+$${profitLoss}` : "",
        icon: "✓"
      };
    case "LOSS":
      return {
        text: "LOSS",
        subtext: profitLoss ? `-$${Math.abs(profitLoss)}` : "",
        icon: "✗"
      };
    case "CANCELLED":
      return {
        text: "CANCELLED",
        subtext: "",
        icon: "⊘"
      };
    case "PENDING":
    default:
      return {
        text: "PENDING",
        subtext: "",
        icon: "⏳"
      };
  }
}

// Get EV classification
function getEVClassification(ev: number): "HIGH" | "MEDIUM" | "LOW" | "NEGATIVE" {
  if (ev > 0.05) return "HIGH";
  if (ev > 0.02) return "MEDIUM";
  if (ev > 0) return "LOW";
  return "NEGATIVE";
}

// Get confidence level
function getConfidenceLevel(confidence: number): "HIGH CONVICTION" | "MEDIUM" | "LOW" | "NO EDGE" {
  if (confidence >= 80) return "HIGH CONVICTION";
  if (confidence >= 65) return "MEDIUM";
  if (confidence >= 50) return "LOW";
  return "NO EDGE";
}

// Get relative time string
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

// Get result color for visual display
function getResultColor(outcome: string): string {
  switch (outcome) {
    case "WIN": return "#10b981"; // green
    case "LOSS": return "#ef4444"; // red
    case "CANCELLED": return "#6b7280"; // gray
    case "PENDING": return "#f59e0b"; // amber
    default: return "#6b7280"; // gray
  }
}

// Get EV color for visual display
function getEVColor(ev: number): string {
  if (ev > 0.05) return "#10b981"; // green
  if (ev > 0.02) return "#f59e0b"; // amber
  if (ev > 0) return "#6b7280"; // gray
  return "#ef4444"; // red
}

// Get direction icon
function getDirectionIcon(direction: string): string {
  switch (direction) {
    case "ABOVE": return "📈";
    case "BELOW": return "📉";
    case "WAIT": return "⏸";
    default: return "❓";
  }
}

// Calculate history summary
function calculateHistorySummary(signals: any[]) {
  const total = signals.length;
  const executed = signals.filter(s => s.tradeExecuted).length;
  const completed = signals.filter(s => s.outcome !== "PENDING").length;
  const wins = signals.filter(s => s.outcome === "WIN").length;
  const losses = signals.filter(s => s.outcome === "LOSS").length;
  
  const totalPnL = signals.reduce((sum, s) => sum + (s.profitLoss || 0), 0);
  const avgEV = signals.length > 0 ? signals.reduce((sum, s) => sum + s.ev, 0) / signals.length : 0;
  const avgProbability = signals.length > 0 ? signals.reduce((sum, s) => sum + s.probability, 0) / signals.length : 0;
  const avgConfidence = signals.length > 0 ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length : 0;
  
  // Direction breakdown
  const aboveSignals = signals.filter(s => s.direction === "ABOVE");
  const belowSignals = signals.filter(s => s.direction === "BELOW");
  const waitSignals = signals.filter(s => s.direction === "WAIT");
  
  const aboveWins = aboveSignals.filter(s => s.outcome === "WIN").length;
  const belowWins = belowSignals.filter(s => s.outcome === "WIN").length;
  
  // EV classification breakdown
  const highEV = signals.filter(s => s.ev > 0.05).length;
  const mediumEV = signals.filter(s => s.ev > 0.02 && s.ev <= 0.05).length;
  const lowEV = signals.filter(s => s.ev > 0 && s.ev <= 0.02).length;
  const negativeEV = signals.filter(s => s.ev <= 0).length;
  
  // Recent performance (last 10)
  const recent = signals.slice(-10);
  const recentWins = recent.filter(s => s.outcome === "WIN").length;
  const recentPnL = recent.reduce((sum, s) => sum + (s.profitLoss || 0), 0);
  
  return {
    total,
    executed,
    completed,
    wins,
    losses,
    winRate: completed > 0 ? Math.round((wins / completed) * 100 * 10) / 10 : 0,
    totalPnL: Math.round(totalPnL * 100) / 100,
    avgEV: Math.round(avgEV * 1000) / 1000,
    avgProbability: Math.round(avgProbability * 10) / 10,
    avgConfidence: Math.round(avgConfidence * 10) / 10,
    directional: {
      above: {
        total: aboveSignals.length,
        wins: aboveWins,
        winRate: aboveSignals.length > 0 ? Math.round((aboveWins / aboveSignals.length) * 100 * 10) / 10 : 0
      },
      below: {
        total: belowSignals.length,
        wins: belowWins,
        winRate: belowSignals.length > 0 ? Math.round((belowWins / belowSignals.length) * 100 * 10) / 10 : 0
      },
      wait: {
        total: waitSignals.length,
        wins: 0,
        winRate: 0
      }
    },
    evClassification: {
      high: highEV,
      medium: mediumEV,
      low: lowEV,
      negative: negativeEV,
      highWinRate: highEV > 0 ? Math.round((signals.filter(s => s.ev > 0.05 && s.outcome === "WIN").length / highEV) * 100 * 10) / 10 : 0
    },
    recent: {
      signals: recent.length,
      wins: recentWins,
      winRate: recent.length > 0 ? Math.round((recentWins / recent.length) * 100 * 10) / 10 : 0,
      pnl: Math.round(recentPnL * 100) / 100
    }
  };
}

// Calculate history trends
function calculateHistoryTrends(signals: any[]) {
  const completed = signals.filter(s => s.outcome !== "PENDING");
  
  if (completed.length < 5) {
    return {
      trend: "INSUFFICIENT_DATA",
      direction: "NEUTRAL",
      strength: 0,
      recentWinRate: 0,
      overallWinRate: 0,
      evTrend: "STABLE",
      confidenceTrend: "STABLE"
    };
  }
  
  // Calculate recent vs overall performance
  const recent = completed.slice(-10);
  const overall = completed;
  
  const recentWins = recent.filter(s => s.outcome === "WIN").length;
  const overallWins = overall.filter(s => s.outcome === "WIN").length;
  
  const recentWinRate = (recentWins / recent.length) * 100;
  const overallWinRate = (overallWins / overall.length) * 100;
  
  // Determine trend
  const winRateDiff = recentWinRate - overallWinRate;
  let trend = "STABLE";
  let direction = "NEUTRAL";
  let strength = Math.abs(winRateDiff);
  
  if (winRateDiff > 10) {
    trend = "IMPROVING";
    direction = "UP";
  } else if (winRateDiff < -10) {
    trend = "DECLINING";
    direction = "DOWN";
  }
  
  // EV trend
  const recentEV = recent.reduce((sum, s) => sum + s.ev, 0) / recent.length;
  const overallEV = overall.reduce((sum, s) => sum + s.ev, 0) / overall.length;
  const evTrend = recentEV > overallEV + 0.01 ? "RISING" : recentEV < overallEV - 0.01 ? "FALLING" : "STABLE";
  
  // Confidence trend
  const recentConf = recent.reduce((sum, s) => sum + s.confidence, 0) / recent.length;
  const overallConf = overall.reduce((sum, s) => sum + s.confidence, 0) / overall.length;
  const confTrend = recentConf > overallConf + 5 ? "RISING" : recentConf < overallConf - 5 ? "FALLING" : "STABLE";
  
  return {
    trend,
    direction,
    strength: Math.round(strength * 10) / 10,
    recentWinRate: Math.round(recentWinRate * 10) / 10,
    overallWinRate: Math.round(overallWinRate * 10) / 10,
    evTrend,
    confidenceTrend: confTrend,
    avgEV: Math.round(recentEV * 1000) / 1000,
    avgConfidence: Math.round(recentConf * 10) / 10
  };
}
