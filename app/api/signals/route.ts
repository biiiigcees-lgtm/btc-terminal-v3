// app/api/signals/route.ts — Signal Log Panel API

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
    const sessionId = url.searchParams.get("sessionId") || undefined;
    
    // Get signal history
    const signals = getSignalHistory(limit, sessionId, outcome);
    
    // Filter by direction if specified
    let filteredSignals = signals;
    if (direction && direction !== "ALL") {
      filteredSignals = signals.filter(s => s.direction === direction);
    }
    
    // Format signals for display
    const formattedSignals = filteredSignals.map(signal => ({
      id: signal.id,
      timestamp: signal.timestamp,
      direction: signal.direction,
      ev: Math.round(signal.ev * 1000) / 1000,
      probability: signal.probability,
      confidence: signal.confidence,
      outcome: signal.outcome,
      profitLoss: signal.profitLoss ? Math.round(signal.profitLoss * 100) / 100 : null,
      holdDuration: signal.holdDuration ? Math.round(signal.holdDuration * 10) / 10 : null,
      alphaScore: signal.alphaScore,
      consensusStrength: signal.consensusStrength,
      tradeExecuted: signal.tradeExecuted,
      tradeType: signal.tradeType,
      quality: signal.quality,
      regime: signal.regime,
      price: signal.price,
      // Format timestamp for display
      time: new Date(signal.timestamp).toLocaleString(),
      // Relative time
      relativeTime: getRelativeTime(signal.timestamp),
      // Result indicator
      result: getResultIndicator(signal.outcome, signal.profitLoss),
      // EV classification
      evClass: getEVClass(signal.ev),
      // Trade class
      tradeClass: getTradeClass(signal.ev, signal.probability, signal.confidence)
    }));
    
    // Calculate summary statistics for the displayed signals
    const summary = calculateSignalSummary(formattedSignals);
    
    // Get performance trends
    const trends = calculatePerformanceTrends(filteredSignals);
    
    return NextResponse.json({
      signals: formattedSignals,
      summary,
      trends,
      pagination: {
        total: filteredSignals.length,
        limit,
        hasMore: signals.length > limit
      },
      filters: {
        outcome,
        direction,
        sessionId
      },
      timestamp: Date.now()
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Signals API error:", err);
    return NextResponse.json({ error: "Signal data fetch failed" }, { status: 500 });
  }
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

// Get result indicator for display
function getResultIndicator(outcome: string, profitLoss: number | null): {
  text: string;
  color: string;
  icon: string;
} {
  switch (outcome) {
    case "WIN":
      return {
        text: profitLoss ? `+$${profitLoss}` : "WIN",
        color: "#10b981", // green
        icon: "✓"
      };
    case "LOSS":
      return {
        text: profitLoss ? `-$${Math.abs(profitLoss)}` : "LOSS",
        color: "#ef4444", // red
        icon: "✗"
      };
    case "CANCELLED":
      return {
        text: "CANCELLED",
        color: "#6b7280", // gray
        icon: "⊘"
      };
    case "PENDING":
    default:
      return {
        text: "PENDING",
        color: "#f59e0b", // amber
        icon: "⏳"
      };
  }
}

// Get EV classification
function getEVClass(ev: number): {
  level: "HIGH" | "MEDIUM" | "LOW" | "NEGATIVE";
  color: string;
  description: string;
} {
  if (ev > 0.05) {
    return {
      level: "HIGH",
      color: "#10b981", // green
      description: "High EV"
    };
  } else if (ev > 0.02) {
    return {
      level: "MEDIUM",
      color: "#f59e0b", // amber
      description: "Medium EV"
    };
  } else if (ev > 0) {
    return {
      level: "LOW",
      color: "#6b7280", // gray
      description: "Low EV"
    };
  } else {
    return {
      level: "NEGATIVE",
      color: "#ef4444", // red
      description: "Negative EV"
    };
  }
}

// Get trade class (simplified version)
function getTradeClass(ev: number, probability: number, confidence: number): {
  level: "HIGH_EDGE" | "MEDIUM" | "LOW" | "NO_TRADE";
  color: string;
  shouldDisplay: boolean;
} {
  if (ev <= 0 || probability < 55) {
    return {
      level: "NO_TRADE",
      color: "#374151", // gray
      shouldDisplay: false
    };
  }
  
  if (ev >= 0.05 && probability >= 75 && confidence >= 80) {
    return {
      level: "HIGH_EDGE",
      color: "#10b981", // green
      shouldDisplay: true
    };
  }
  
  if (ev >= 0.02 && probability >= 60 && confidence >= 65) {
    return {
      level: "MEDIUM",
      color: "#f59e0b", // amber
      shouldDisplay: true
    };
  }
  
  return {
    level: "LOW",
    color: "#6b7280", // gray
    shouldDisplay: true
  };
}

// Calculate signal summary statistics
function calculateSignalSummary(signals: any[]) {
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
    // Recent performance (last 10)
    recent: {
      signals: signals.slice(-10).length,
      wins: signals.slice(-10).filter(s => s.outcome === "WIN").length,
      pnl: Math.round(signals.slice(-10).reduce((sum, s) => sum + (s.profitLoss || 0), 0) * 100) / 100
    }
  };
}

// Calculate performance trends
function calculatePerformanceTrends(signals: any[]) {
  const completed = signals.filter(s => s.outcome !== "PENDING");
  
  if (completed.length < 5) {
    return {
      trend: "INSUFFICIENT_DATA",
      direction: "NEUTRAL",
      strength: 0,
      recentWinRate: 0,
      overallWinRate: 0
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
  
  return {
    trend,
    direction,
    strength: Math.round(strength * 10) / 10,
    recentWinRate: Math.round(recentWinRate * 10) / 10,
    overallWinRate: Math.round(overallWinRate * 10) / 10
  };
}
