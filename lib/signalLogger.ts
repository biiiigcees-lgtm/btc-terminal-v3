// lib/signalLogger.ts — Signal Logger with database persistence

import type { Indicators, Candle, MarketData } from "@/types";
import { AlphaScoreResult } from "./alphaEngine";
import { KalshiSignal, KalshiProbability } from "./kalshiEngine";
import { ConsensusResult, AgentWeights } from "./consensusEngine";
import { TradeCandidate, EVAnalysis } from "./evEngine";
import { FilterResult } from "./tradeFilter";
import { TradeOpportunity, SelectionResult } from "./tradeSelector";

export interface SignalLog {
  id: string;
  timestamp: number;
  price: number;
  direction: "ABOVE" | "BELOW" | "WAIT";
  
  // Alpha score components
  alphaScore: number;
  alphaConfidence: number;
  alphaDirection: "ABOVE" | "BELOW" | "WAIT";
  regime: string;
  regimeStrength: number;
  
  // Consensus components
  consensusDirection: "ABOVE" | "BELOW" | "NEUTRAL";
  consensusStrength: number;
  consensusAgreement: number;
  consensusConfidence: number;
  agentVotes: {
    momentum: { direction: string; confidence: number };
    volatility: { direction: string; confidence: number };
    meanReversion: { direction: string; confidence: number };
    orderFlow: { direction: string; confidence: number };
    kalshi: { direction: string; confidence: number };
  };
  
  // EV components
  ev: number;
  riskAdjustedEV: number;
  probability: number;
  riskReward: number;
  kellyFraction: number;
  positionSize: number;
  
  // Trade execution
  tradeExecuted: boolean;
  tradeType: "KALSHI" | "SPOT" | null;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  timeHorizon: number | null;
  
  // Outcome (filled later)
  outcome: "WIN" | "LOSS" | "PENDING" | "CANCELLED";
  exitPrice: number | null;
  profitLoss: number | null;
  exitTime: number | null;
  holdDuration: number | null;
  
  // Market context
  volatility: number;
  volume: number;
  rsi: number;
  atr: number;
  
  // Performance tracking
  wasCorrect: boolean | null;
  confidenceAccuracy: number | null;
  evAccuracy: number | null;
  
  // Metadata
  sessionId: string;
  signals: string[];
  warnings: string[];
  quality: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | null;
}

export interface PerformanceStats {
  totalSignals: number;
  executedTrades: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  totalPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldDuration: number;
  accuracyByDirection: {
    ABOVE: { correct: number; total: number; rate: number };
    BELOW: { correct: number; total: number; rate: number };
    WAIT: { correct: number; total: number; rate: number };
  };
  accuracyByRegime: Record<string, { correct: number; total: number; rate: number }>;
  performanceByAgent: Record<string, { correct: number; total: number; rate: number }>;
}

export interface LoggingConfig {
  maxSignals: number;
  persistToDatabase: boolean;
  enablePerformanceTracking: boolean;
  retentionDays: number;
  batchSize: number;
}

// Default configuration
const DEFAULT_CONFIG: LoggingConfig = {
  maxSignals: 500,
  persistToDatabase: true,
  enablePerformanceTracking: true,
  retentionDays: 30,
  batchSize: 50
};

// In-memory signal storage (fallback when DB not available)
let signalCache: SignalLog[] = [];
let agentWeights: AgentWeights = {
  momentum: 0.25,
  volatility: 0.2,
  meanReversion: 0.2,
  orderFlow: 0.15,
  kalshi: 0.2,
  lastUpdated: Date.now(),
  totalTrades: 0
};

// Generate unique signal ID
function generateSignalId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create signal log from all engine outputs
export function createSignalLog(
  alpha: AlphaScoreResult,
  consensus: ConsensusResult,
  evAnalysis: EVAnalysis | null,
  filterResult: FilterResult | null,
  selectionResult: SelectionResult | null,
  indicators: Indicators,
  market: MarketData,
  kalshiProbability: KalshiProbability | null = null,
  sessionId: string = "default"
): SignalLog {
  const id = generateSignalId();
  const timestamp = Date.now();
  
  // Extract agent votes
  const agentVotes = consensus.votes.reduce((acc, vote) => {
    acc[vote.agent as keyof typeof acc] = {
      direction: vote.direction,
      confidence: vote.confidence
    };
    return acc;
  }, {} as SignalLog["agentVotes"]);
  
  // Determine final direction (prioritize selection, then consensus, then alpha)
  let direction: SignalLog["direction"] = alpha.direction;
  if (selectionResult?.bestTrade) {
    direction = selectionResult.bestTrade.direction;
  } else if (consensus.direction !== "NEUTRAL") {
    direction = consensus.direction;
  }
  
  // Extract trade execution details
  const tradeExecuted = !!selectionResult?.bestTrade;
  const tradeType = selectionResult?.bestTrade?.type || null;
  const entryPrice = selectionResult?.bestTrade?.entryPrice || null;
  const targetPrice = selectionResult?.bestTrade?.targetPrice || null;
  const stopLoss = selectionResult?.bestTrade?.stopLoss || null;
  const timeHorizon = selectionResult?.bestTrade?.timeHorizon || null;
  
  // Calculate quality
  const quality = selectionResult?.bestTrade?.quality || 
    (alpha.alphaScore > 80 ? "EXCELLENT" : 
     alpha.alphaScore > 70 ? "GOOD" : 
     alpha.alphaScore > 60 ? "FAIR" : "POOR");
  
  // Combine all signals
  const signals = [...alpha.signals, ...consensus.votes.map(v => `${v.agent}: ${v.direction}`)];
  if (evAnalysis) signals.push(`EV: ${evAnalysis.ev.ev}`);
  if (filterResult?.warnings.length) signals.push(...filterResult.warnings);
  
  return {
    id,
    timestamp,
    price: market.price,
    direction,
    
    // Alpha components
    alphaScore: alpha.alphaScore,
    alphaConfidence: alpha.confidence,
    alphaDirection: alpha.direction,
    regime: alpha.regime.regime,
    regimeStrength: alpha.regime.strength,
    
    // Consensus components
    consensusDirection: consensus.direction,
    consensusStrength: consensus.strength,
    consensusAgreement: consensus.agreement,
    consensusConfidence: consensus.confidence,
    agentVotes,
    
    // EV components
    ev: evAnalysis?.ev.ev || 0,
    riskAdjustedEV: evAnalysis?.ev.riskAdjustedEV || 0,
    probability: evAnalysis?.candidate.probability || 0,
    riskReward: evAnalysis?.ev.riskReward || 0,
    kellyFraction: evAnalysis?.ev.kellyFraction || 0,
    positionSize: evAnalysis?.ev.positionSize || 0,
    
    // Trade execution
    tradeExecuted,
    tradeType,
    entryPrice,
    targetPrice,
    stopLoss,
    timeHorizon,
    
    // Outcome (filled later)
    outcome: "PENDING",
    exitPrice: null,
    profitLoss: null,
    exitTime: null,
    holdDuration: null,
    
    // Market context
    volatility: (indicators.atr / market.price) * 100,
    volume: market.volume24h,
    rsi: indicators.rsi,
    atr: indicators.atr,
    
    // Performance tracking (filled later)
    wasCorrect: null,
    confidenceAccuracy: null,
    evAccuracy: null,
    
    // Metadata
    sessionId,
    signals,
    warnings: filterResult?.warnings || [],
    quality
  };
}

// Log signal to memory and optionally database
export async function logSignal(
  signal: SignalLog,
  config: Partial<LoggingConfig> = {}
): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Add to memory cache
  signalCache.unshift(signal);
  
  // Limit cache size
  if (signalCache.length > finalConfig.maxSignals) {
    signalCache = signalCache.slice(0, finalConfig.maxSignals);
  }
  
  // Persist to database if enabled
  if (finalConfig.persistToDatabase) {
    try {
      await persistSignalToDatabase(signal, finalConfig);
    } catch (error) {
      console.error("Failed to persist signal to database:", error);
      // Continue without failing the operation
    }
  }
}

// Resolve signal outcome
export async function resolveSignal(
  signalId: string,
  outcome: "WIN" | "LOSS" | "CANCELLED",
  exitPrice: number | null = null,
  config: Partial<LoggingConfig> = {}
): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Find signal in cache
  const signalIndex = signalCache.findIndex(s => s.id === signalId);
  if (signalIndex === -1) {
    console.warn(`Signal ${signalId} not found in cache`);
    return;
  }
  
  const signal = signalCache[signalIndex];
  const exitTime = Date.now();
  const holdDuration = (exitTime - signal.timestamp) / (1000 * 60); // minutes
  
  // Calculate P&L
  let profitLoss: number | null = null;
  if (outcome !== "CANCELLED" && signal.entryPrice && exitPrice) {
    if (signal.direction === "ABOVE") {
      profitLoss = signal.tradeType === "KALSHI" ? 
        (exitPrice > signal.targetPrice ? 1 : -1) : // Binary outcome
        (exitPrice - signal.entryPrice); // Spot trade
    } else {
      profitLoss = signal.tradeType === "KALSHI" ? 
        (exitPrice < signal.targetPrice ? 1 : -1) : // Binary outcome
        (signal.entryPrice - exitPrice); // Spot trade
    }
  }
  
  // Determine if signal was correct
  let wasCorrect: boolean | null = null;
  if (outcome !== "CANCELLED" && signal.targetPrice && exitPrice) {
    if (signal.direction === "ABOVE") {
      wasCorrect = exitPrice > signal.targetPrice;
    } else {
      wasCorrect = exitPrice < signal.targetPrice;
    }
  }
  
  // Update signal
  const updatedSignal: SignalLog = {
    ...signal,
    outcome,
    exitPrice,
    profitLoss,
    exitTime,
    holdDuration,
    wasCorrect,
    confidenceAccuracy: wasCorrect !== null ? Math.abs(signal.consensusConfidence - (wasCorrect ? 100 : 0)) : null,
    evAccuracy: wasCorrect !== null ? Math.abs(signal.ev - (wasCorrect ? signal.ev : -Math.abs(signal.ev))) : null
  };
  
  // Update cache
  signalCache[signalIndex] = updatedSignal;
  
  // Update agent weights based on performance
  if (finalConfig.enablePerformanceTracking && wasCorrect !== null) {
    updateAgentPerformance(signal.agentVotes, wasCorrect);
  }
  
  // Persist to database
  if (finalConfig.persistToDatabase) {
    try {
      await updateSignalInDatabase(updatedSignal, finalConfig);
    } catch (error) {
      console.error("Failed to update signal in database:", error);
    }
  }
}

// Get signal history
export function getSignalHistory(
  limit: number = 100,
  sessionId?: string,
  outcome?: "WIN" | "LOSS" | "PENDING" | "CANCELLED"
): SignalLog[] {
  let filtered = [...signalCache];
  
  if (sessionId) {
    filtered = filtered.filter(s => s.sessionId === sessionId);
  }
  
  if (outcome) {
    filtered = filtered.filter(s => s.outcome === outcome);
  }
  
  return filtered.slice(0, limit);
}

// Calculate performance statistics
export function calculatePerformanceStats(
  signals?: SignalLog[]
): PerformanceStats {
  const sourceSignals = signals || signalCache;
  const executedTrades = sourceSignals.filter(s => s.tradeExecuted);
  const completedTrades = executedTrades.filter(s => s.outcome === "WIN" || s.outcome === "LOSS");
  const wins = completedTrades.filter(s => s.outcome === "WIN");
  const losses = completedTrades.filter(s => s.outcome === "LOSS");
  
  const winRate = completedTrades.length > 0 ? (wins.length / completedTrades.length) * 100 : 0;
  
  const avgProfit = wins.length > 0 ? 
    wins.reduce((sum, s) => sum + (s.profitLoss || 0), 0) / wins.length : 0;
  
  const avgLoss = losses.length > 0 ? 
    Math.abs(losses.reduce((sum, s) => sum + (s.profitLoss || 0), 0) / losses.length) : 0;
  
  const totalPnL = completedTrades.reduce((sum, s) => sum + (s.profitLoss || 0), 0);
  
  // Calculate Sharpe ratio (simplified)
  const returns = completedTrades.map(s => s.profitLoss || 0);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const returnStdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
  
  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnL = 0;
  
  completedTrades.forEach(trade => {
    runningPnL += trade.profitLoss || 0;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = peak - runningPnL;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });
  
  // Average hold duration
  const avgHoldDuration = completedTrades.length > 0 ? 
    completedTrades.reduce((sum, s) => sum + (s.holdDuration || 0), 0) / completedTrades.length : 0;
  
  // Accuracy by direction
  const accuracyByDirection = {
    ABOVE: calculateDirectionAccuracy(sourceSignals, "ABOVE"),
    BELOW: calculateDirectionAccuracy(sourceSignals, "BELOW"),
    WAIT: calculateDirectionAccuracy(sourceSignals, "WAIT")
  };
  
  // Accuracy by regime
  const accuracyByRegime: Record<string, { correct: number; total: number; rate: number }> = {};
  const regimes = [...new Set(sourceSignals.map(s => s.regime))];
  regimes.forEach(regime => {
    const regimeSignals = sourceSignals.filter(s => s.regime === regime);
    const correct = regimeSignals.filter(s => s.wasCorrect === true).length;
    const total = regimeSignals.filter(s => s.wasCorrect !== null).length;
    accuracyByRegime[regime] = {
      correct,
      total,
      rate: total > 0 ? (correct / total) * 100 : 0
    };
  });
  
  // Performance by agent
  const performanceByAgent: Record<string, { correct: number; total: number; rate: number }> = {};
  const agents = ["momentum", "volatility", "meanReversion", "orderFlow", "kalshi"];
  agents.forEach(agent => {
    let correct = 0;
    let total = 0;
    
    sourceSignals.forEach(signal => {
      if (signal.wasCorrect !== null) {
        total++;
        const vote = signal.agentVotes[agent as keyof typeof signal.agentVotes];
        if (vote && (
          (signal.wasCorrect && vote.direction === signal.direction) ||
          (!signal.wasCorrect && vote.direction !== signal.direction)
        )) {
          correct++;
        }
      }
    });
    
    performanceByAgent[agent] = {
      correct,
      total,
      rate: total > 0 ? (correct / total) * 100 : 0
    };
  });
  
  return {
    totalSignals: sourceSignals.length,
    executedTrades: executedTrades.length,
    wins: wins.length,
    losses: losses.length,
    pending: sourceSignals.filter(s => s.outcome === "PENDING").length,
    winRate: Math.round(winRate * 10) / 10,
    avgProfit: Math.round(avgProfit * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    totalPnL: Math.round(totalPnL * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    avgHoldDuration: Math.round(avgHoldDuration * 10) / 10,
    accuracyByDirection,
    accuracyByRegime,
    performanceByAgent
  };
}

// Helper function to calculate direction accuracy
function calculateDirectionAccuracy(
  signals: SignalLog[],
  direction: "ABOVE" | "BELOW" | "WAIT"
): { correct: number; total: number; rate: number } {
  const directionSignals = signals.filter(s => s.direction === direction);
  const correct = directionSignals.filter(s => s.wasCorrect === true).length;
  const total = directionSignals.filter(s => s.wasCorrect !== null).length;
  
  return {
    correct,
    total,
    rate: total > 0 ? (correct / total) * 100 : 0
  };
}

// Update agent performance weights
function updateAgentPerformance(
  agentVotes: SignalLog["agentVotes"],
  wasCorrect: boolean
): void {
  Object.entries(agentVotes).forEach(([agent, vote]) => {
    const currentWeight = agentWeights[agent as keyof AgentWeights];
    const performance = wasCorrect ? 1 : 0;
    
    // Simple learning rate adjustment
    const learningRate = 0.01;
    const adjustment = (performance - 0.5) * learningRate;
    
    agentWeights[agent as keyof AgentWeights] = Math.max(0.05, Math.min(0.4, currentWeight + adjustment));
  });
  
  // Normalize weights
  const totalWeight = Object.values(agentWeights).reduce((sum, w) => 
    typeof w === "number" ? sum + w : sum, 0
  );
  
  Object.keys(agentWeights).forEach(key => {
    const value = agentWeights[key as keyof AgentWeights];
    if (typeof value === "number") {
      agentWeights[key as keyof AgentWeights] = value / totalWeight;
    }
  });
  
  agentWeights.lastUpdated = Date.now();
  agentWeights.totalTrades++;
}

// Get current agent weights
export function getAgentWeights(): AgentWeights {
  return { ...agentWeights };
}

// Database persistence functions (simplified - would use actual DB in production)
async function persistSignalToDatabase(signal: SignalLog, config: LoggingConfig): Promise<void> {
  // In production, this would save to PostgreSQL/SQLite
  // For now, we'll just log it
  console.log(`Persisting signal ${signal.id} to database`);
}

async function updateSignalInDatabase(signal: SignalLog, config: LoggingConfig): Promise<void> {
  // In production, this would update the database record
  console.log(`Updating signal ${signal.id} in database with outcome ${signal.outcome}`);
}

// Cleanup old signals
export function cleanupOldSignals(retentionDays: number = 30): void {
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  signalCache = signalCache.filter(s => s.timestamp > cutoffTime);
}

// Export signals for analysis
export function exportSignals(format: "json" | "csv" = "json"): string {
  if (format === "json") {
    return JSON.stringify(signalCache, null, 2);
  } else {
    // CSV export
    const headers = [
      "id", "timestamp", "price", "direction", "alphaScore", "consensusStrength",
      "ev", "probability", "tradeExecuted", "outcome", "profitLoss"
    ];
    
    const rows = signalCache.map(s => [
      s.id,
      s.timestamp,
      s.price,
      s.direction,
      s.alphaScore,
      s.consensusStrength,
      s.ev,
      s.probability,
      s.tradeExecuted,
      s.outcome,
      s.profitLoss || ""
    ]);
    
    return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  }
}
