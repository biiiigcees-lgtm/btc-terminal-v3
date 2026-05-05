// app/api/simulation/route.ts — Live PnL tracking and simulation engine

import { NextResponse } from "next/server";
import { getSignalHistory, resolveSignal, calculatePerformanceStats } from "@/lib/signalLogger";

export const dynamic = "force-dynamic";

interface SimulationTrade {
  id: string;
  entryTime: number;
  entryPrice: number;
  direction: "ABOVE" | "BELOW";
  targetPrice: number;
  stopLoss: number;
  positionSize: number;
  type: "KALSHI" | "SPOT";
  status: "OPEN" | "CLOSED";
  exitTime?: number;
  exitPrice?: number;
  profitLoss?: number;
  outcome?: "WIN" | "LOSS" | "CANCELLED";
}

interface SimulationState {
  trades: SimulationTrade[];
  currentPnL: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  bankroll: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
}

// In-memory simulation state (would use database in production)
let simulationState: SimulationState = {
  trades: [],
  currentPnL: 0,
  totalTrades: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  maxDrawdown: 0,
  sharpeRatio: 0,
  bankroll: 25,
  dailyPnL: 0,
  weeklyPnL: 0,
  monthlyPnL: 0
};

// Simulate trade execution
export async function POST(request: Request) {
  try {
    const { action, tradeData } = await request.json();
    
    switch (action) {
      case "execute_trade":
        return executeTrade(tradeData);
      case "close_trade":
        return closeTrade(tradeData);
      case "reset_simulation":
        return resetSimulation();
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Simulation POST error:", err);
    return NextResponse.json({ error: "Simulation action failed" }, { status: 500 });
  }
}

function executeTrade(tradeData: any) {
  const { id, entryPrice, direction, targetPrice, stopLoss, positionSize, type } = tradeData;
  
  const trade: SimulationTrade = {
    id,
    entryTime: Date.now(),
    entryPrice,
    direction,
    targetPrice,
    stopLoss,
    positionSize,
    type,
    status: "OPEN"
  };
  
  simulationState.trades.push(trade);
  simulationState.totalTrades++;
  
  return NextResponse.json({
    success: true,
    trade,
    state: simulationState
  });
}

function closeTrade(tradeData: any) {
  const { id, exitPrice, outcome } = tradeData;
  
  const tradeIndex = simulationState.trades.findIndex(t => t.id === id);
  if (tradeIndex === -1) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }
  
  const trade = simulationState.trades[tradeIndex];
  if (trade.status !== "OPEN") {
    return NextResponse.json({ error: "Trade already closed" }, { status: 400 });
  }
  
  // Calculate P&L
  let profitLoss = 0;
  if (trade.type === "KALSHI") {
    // Binary outcome
    profitLoss = outcome === "WIN" ? positionSize : -positionSize;
  } else {
    // Spot trade
    if (trade.direction === "ABOVE") {
      profitLoss = (exitPrice - trade.entryPrice) * (trade.positionSize / trade.entryPrice);
    } else {
      profitLoss = (trade.entryPrice - exitPrice) * (trade.positionSize / trade.entryPrice);
    }
  }
  
  // Update trade
  trade.status = "CLOSED";
  trade.exitTime = Date.now();
  trade.exitPrice = exitPrice;
  trade.profitLoss = profitLoss;
  trade.outcome = outcome;
  
  // Update state
  simulationState.currentPnL += profitLoss;
  simulationState.bankroll += profitLoss;
  
  if (outcome === "WIN") {
    simulationState.wins++;
  } else {
    simulationState.losses++;
  }
  
  simulationState.winRate = (simulationState.wins / simulationState.totalTrades) * 100;
  
  // Calculate drawdown
  const peak = Math.max(...simulationState.trades.map(t => t.entryPrice));
  const currentDrawdown = (peak - exitPrice) / peak * 100;
  simulationState.maxDrawdown = Math.max(simulationState.maxDrawdown, currentDrawdown);
  
  // Calculate Sharpe ratio (simplified)
  const returns = simulationState.trades
    .filter(t => t.status === "CLOSED")
    .map(t => (t.profitLoss || 0) / t.positionSize);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const returnStdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  simulationState.sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
  
  // Update time-based P&L
  updatePeriodicPnL();
  
  // Resolve signal in logger
  resolveSignal(id, outcome, exitPrice).catch(err => 
    console.error("Failed to resolve signal:", err)
  );
  
  return NextResponse.json({
    success: true,
    trade,
    state: simulationState
  });
}

function resetSimulation() {
  simulationState = {
    trades: [],
    currentPnL: 0,
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    bankroll: 25,
    dailyPnL: 0,
    weeklyPnL: 0,
    monthlyPnL: 0
  };
  
  return NextResponse.json({
    success: true,
    state: simulationState
  });
}

function updatePeriodicPnL() {
  const now = Date.now();
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  
  // Calculate P&L for different periods
  const recentTrades = simulationState.trades.filter(t => t.status === "CLOSED");
  
  simulationState.dailyPnL = recentTrades
    .filter(t => t.exitTime && t.exitTime > dayStart)
    .reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    
  simulationState.weeklyPnL = recentTrades
    .filter(t => t.exitTime && t.exitTime > weekStart)
    .reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    
  simulationState.monthlyPnL = recentTrades
    .filter(t => t.exitTime && t.exitTime > monthStart)
    .reduce((sum, t) => sum + (t.profitLoss || 0), 0);
}

// Get simulation state and performance
export async function GET() {
  try {
    // Get signal history for additional performance metrics
    const signalHistory = getSignalHistory(100);
    const performanceStats = calculatePerformanceStats(signalHistory);
    
    // Calculate current market exposure
    const openTrades = simulationState.trades.filter(t => t.status === "OPEN");
    const currentExposure = openTrades.reduce((sum, t) => sum + t.positionSize, 0);
    
    // Calculate unrealized P&L (would need current market prices)
    const unrealizedPnL = 0; // Simplified - would calculate based on current prices
    
    // Risk metrics
    const riskMetrics = {
      currentExposure,
      unrealizedPnL,
      exposureRatio: simulationState.bankroll > 0 ? currentExposure / simulationState.bankroll : 0,
      avgTradeSize: simulationState.totalTrades > 0 ? 
        openTrades.reduce((sum, t) => sum + t.positionSize, 0) / openTrades.length : 0,
      maxPositionSize: Math.max(...simulationState.trades.map(t => t.positionSize)),
      avgHoldTime: simulationState.trades
        .filter(t => t.status === "CLOSED" && t.exitTime)
        .reduce((sum, t) => sum + ((t.exitTime! - t.entryTime) / (1000 * 60)), 0) / 
        simulationState.trades.filter(t => t.status === "CLOSED").length || 0
    };
    
    // Performance by direction
    const directionalPerformance = {
      ABOVE: {
        trades: simulationState.trades.filter(t => t.direction === "ABOVE"),
        wins: simulationState.trades.filter(t => t.direction === "ABOVE" && t.outcome === "WIN").length,
        totalPnL: simulationState.trades
          .filter(t => t.direction === "ABOVE")
          .reduce((sum, t) => sum + (t.profitLoss || 0), 0)
      },
      BELOW: {
        trades: simulationState.trades.filter(t => t.direction === "BELOW"),
        wins: simulationState.trades.filter(t => t.direction === "BELOW" && t.outcome === "WIN").length,
        totalPnL: simulationState.trades
          .filter(t => t.direction === "BELOW")
          .reduce((sum, t) => sum + (t.profitLoss || 0), 0)
      }
    };
    
    // Performance by type
    const typePerformance = {
      KALSHI: {
        trades: simulationState.trades.filter(t => t.type === "KALSHI"),
        wins: simulationState.trades.filter(t => t.type === "KALSHI" && t.outcome === "WIN").length,
        totalPnL: simulationState.trades
          .filter(t => t.type === "KALSHI")
          .reduce((sum, t) => sum + (t.profitLoss || 0), 0)
      },
      SPOT: {
        trades: simulationState.trades.filter(t => t.type === "SPOT"),
        wins: simulationState.trades.filter(t => t.type === "SPOT" && t.outcome === "WIN").length,
        totalPnL: simulationState.trades
          .filter(t => t.type === "SPOT")
          .reduce((sum, t) => sum + (t.profitLoss || 0), 0)
      }
    };
    
    // Recent performance (last 10 trades)
    const recentTrades = simulationState.trades
      .filter(t => t.status === "CLOSED")
      .slice(-10);
    const recentWins = recentTrades.filter(t => t.outcome === "WIN").length;
    const recentWinRate = recentTrades.length > 0 ? (recentWins / recentTrades.length) * 100 : 0;
    const recentPnL = recentTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    
    return NextResponse.json({
      simulation: simulationState,
      performance: {
        ...performanceStats,
        recent: {
          trades: recentTrades.length,
          wins: recentWins,
          winRate: Math.round(recentWinRate * 10) / 10,
          pnl: Math.round(recentPnL * 100) / 100
        }
      },
      risk: riskMetrics,
      directional: directionalPerformance,
      byType: typePerformance,
      openPositions: openTrades.map(t => ({
        id: t.id,
        direction: t.direction,
        entryPrice: t.entryPrice,
        targetPrice: t.targetPrice,
        stopLoss: t.stopLoss,
        positionSize: t.positionSize,
        type: t.type,
        duration: Math.round((Date.now() - t.entryTime) / (1000 * 60)), // minutes
        unrealizedPnL: 0 // Would calculate based on current price
      })),
      timestamp: Date.now()
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Simulation GET error:", err);
    return NextResponse.json({ error: "Simulation data fetch failed" }, { status: 500 });
  }
}
