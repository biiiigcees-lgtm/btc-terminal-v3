// lib/signalMemory.ts — SIGNAL MEMORY: store last 100 signals with EV, outcome, resolution time

export interface SignalMemoryEntry {
  id: string;
  timestamp: number;
  direction: "ABOVE" | "BELOW" | "WAIT";
  ev: number;
  probability: number;
  confidence: number;
  alphaScore: number;
  consensusStrength: number;
  consensusAgreement: number;
  kellyFraction: number;
  edgeScore?: number;
  tradeExecuted: boolean;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  outcome?: "WIN" | "LOSS" | "PENDING" | "CANCELLED";
  profitLoss?: number;
  resolutionTime?: number; // Time from signal to outcome resolution
  holdDuration?: number;    // Time trade was held
  reasons: string[];
  warnings: string[];
  marketCondition: string;
  volatility: number;
  regime: string;
}

export interface SignalMemoryStats {
  totalSignals: number;
  executedTrades: number;
  completedTrades: number;
  wins: number;
  losses: number;
  pendingTrades: number;
  avgEV: number;
  avgProbability: number;
  avgConfidence: number;
  avgResolutionTime: number;
  avgHoldDuration: number;
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface SignalMemoryAnalysis {
  stats: SignalMemoryStats;
  recentPerformance: SignalMemoryStats; // Last 20 signals
  evDistribution: {
    high: number;      // EV > 0.06
    medium: number;    // EV 0.04-0.06
    low: number;       // EV 0.02-0.04
    negative: number;  // EV <= 0
  };
  outcomeByEV: {
    high: { wins: number; losses: number; winRate: number };
    medium: { wins: number; losses: number; winRate: number };
    low: { wins: number; losses: number; winRate: number };
    negative: { wins: number; losses: number; winRate: number };
  };
  performanceTrend: "IMPROVING" | "DECLINING" | "STABLE";
  confidenceTrend: "IMPROVING" | "DECLINING" | "STABLE";
  recommendations: string[];
}

// In-memory signal storage (in production, this would be persisted to database)
let signalMemory: SignalMemoryEntry[] = [];
const MAX_MEMORY_SIZE = 100;

// Add signal to memory
export function addSignalToMemory(signal: Omit<SignalMemoryEntry, 'id' | 'timestamp'>): string {
  const entry: SignalMemoryEntry = {
    ...signal,
    id: generateSignalId(),
    timestamp: Date.now()
  };

  // Add to memory
  signalMemory.unshift(entry);

  // Maintain memory size limit
  if (signalMemory.length > MAX_MEMORY_SIZE) {
    signalMemory = signalMemory.slice(0, MAX_MEMORY_SIZE);
  }

  return entry.id;
}

// Generate unique signal ID
function generateSignalId(): string {
  return `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get signal by ID
export function getSignalById(id: string): SignalMemoryEntry | null {
  return signalMemory.find(signal => signal.id === id) || null;
}

// Update signal outcome
export function updateSignalOutcome(
  id: string,
  outcome: "WIN" | "LOSS" | "PENDING" | "CANCELLED",
  profitLoss?: number,
  resolutionTime?: number,
  holdDuration?: number
): boolean {
  const signal = getSignalById(id);
  if (!signal) return false;

  signal.outcome = outcome;
  signal.profitLoss = profitLoss;
  signal.resolutionTime = resolutionTime;
  signal.holdDuration = holdDuration;

  return true;
}

// Get signal memory statistics
export function getSignalMemoryStats(): SignalMemoryStats {
  const totalSignals = signalMemory.length;
  const executedTrades = signalMemory.filter(s => s.tradeExecuted).length;
  const completedTrades = signalMemory.filter(s => s.outcome && s.outcome !== "PENDING").length;
  const wins = signalMemory.filter(s => s.outcome === "WIN").length;
  const losses = signalMemory.filter(s => s.outcome === "LOSS").length;
  const pendingTrades = signalMemory.filter(s => s.outcome === "PENDING").length;

  // Calculate averages
  const evValues = signalMemory.map(s => s.ev);
  const probabilityValues = signalMemory.map(s => s.probability);
  const confidenceValues = signalMemory.map(s => s.confidence);
  const resolutionTimes = signalMemory
    .filter(s => s.resolutionTime !== undefined)
    .map(s => s.resolutionTime!);
  const holdDurations = signalMemory
    .filter(s => s.holdDuration !== undefined)
    .map(s => s.holdDuration!);
  const pnlValues = signalMemory
    .filter(s => s.profitLoss !== undefined)
    .map(s => s.profitLoss!);

  const avgEV = evValues.length > 0 ? evValues.reduce((sum, ev) => sum + ev, 0) / evValues.length : 0;
  const avgProbability = probabilityValues.length > 0 ? probabilityValues.reduce((sum, p) => sum + p, 0) / probabilityValues.length : 0;
  const avgConfidence = confidenceValues.length > 0 ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length : 0;
  const avgResolutionTime = resolutionTimes.length > 0 ? resolutionTimes.reduce((sum, rt) => sum + rt, 0) / resolutionTimes.length : 0;
  const avgHoldDuration = holdDurations.length > 0 ? holdDurations.reduce((sum, hd) => sum + hd, 0) / holdDurations.length : 0;
  const totalPnL = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
  const winRate = completedTrades > 0 ? (wins / completedTrades) * 100 : 0;

  // Calculate profit factor
  const winningPnL = signalMemory
    .filter(s => s.outcome === "WIN" && s.profitLoss)
    .reduce((sum, s) => sum + s.profitLoss!, 0);
  const losingPnL = Math.abs(signalMemory
    .filter(s => s.outcome === "LOSS" && s.profitLoss)
    .reduce((sum, s) => sum + s.profitLoss!, 0));
  const profitFactor = losingPnL > 0 ? winningPnL / losingPnL : winningPnL > 0 ? Infinity : 0;

  // Calculate Sharpe ratio
  const returns = pnlValues;
  const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
  const variance = returns.length > 1 ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Calculate max drawdown
  let maxDrawdown = 0;
  let cumulativePnL = 0;
  let peak = 0;

  signalMemory
    .filter(s => s.profitLoss !== undefined)
    .forEach(s => {
      cumulativePnL += s.profitLoss!;
      if (cumulativePnL > peak) peak = cumulativePnL;
      const drawdown = peak - cumulativePnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

  // Calculate streaks
  const streaks = calculateStreaks(signalMemory.filter(s => s.outcome && s.outcome !== "PENDING"));

  return {
    totalSignals,
    executedTrades,
    completedTrades,
    wins,
    losses,
    pendingTrades,
    avgEV: Math.round(avgEV * 1000) / 1000,
    avgProbability: Math.round(avgProbability * 10) / 10,
    avgConfidence: Math.round(avgConfidence * 10) / 10,
    avgResolutionTime: Math.round(avgResolutionTime),
    avgHoldDuration: Math.round(avgHoldDuration),
    totalPnL: Math.round(totalPnL * 100) / 100,
    winRate: Math.round(winRate * 10) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    currentStreak: streaks.current,
    longestWinStreak: streaks.longestWin,
    longestLossStreak: streaks.longestLoss
  };
}

// Calculate streaks
function calculateStreaks(completedSignals: SignalMemoryEntry[]): {
  current: number;
  longestWin: number;
  longestLoss: number;
} {
  if (completedSignals.length === 0) {
    return { current: 0, longestWin: 0, longestLoss: 0 };
  }

  let currentStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;

  // Calculate current streak (from most recent)
  for (let i = completedSignals.length - 1; i >= 0; i--) {
    const signal = completedSignals[i];
    if (signal.outcome === "WIN") {
      if (tempLossStreak === 0) currentStreak++;
      else break;
    } else if (signal.outcome === "LOSS") {
      if (tempWinStreak === 0) currentStreak--;
      else break;
    }
  }

  // Calculate longest streaks
  completedSignals.forEach(signal => {
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
    current: currentStreak,
    longestWin: longestWinStreak,
    longestLoss: longestLossStreak
  };
}

// Get signal memory analysis
export function getSignalMemoryAnalysis(): SignalMemoryAnalysis {
  const stats = getSignalMemoryStats();
  const recentSignals = signalMemory.slice(0, 20);
  const recentStats = calculateStatsFromSignals(recentSignals);

  // EV distribution
  const evDistribution = {
    high: signalMemory.filter(s => s.ev > 0.06).length,
    medium: signalMemory.filter(s => s.ev > 0.04 && s.ev <= 0.06).length,
    low: signalMemory.filter(s => s.ev > 0.02 && s.ev <= 0.04).length,
    negative: signalMemory.filter(s => s.ev <= 0.02).length
  };

  // Outcome by EV
  const outcomeByEV = {
    high: calculateOutcomeByEV(signalMemory.filter(s => s.ev > 0.06)),
    medium: calculateOutcomeByEV(signalMemory.filter(s => s.ev > 0.04 && s.ev <= 0.06)),
    low: calculateOutcomeByEV(signalMemory.filter(s => s.ev > 0.02 && s.ev <= 0.04)),
    negative: calculateOutcomeByEV(signalMemory.filter(s => s.ev <= 0.02))
  };

  // Performance trend
  const performanceTrend = calculatePerformanceTrend(signalMemory);
  const confidenceTrend = calculateConfidenceTrend(signalMemory);

  // Generate recommendations
  const recommendations = generateRecommendations(stats, recentStats, outcomeByEV);

  return {
    stats,
    recentPerformance: recentStats,
    evDistribution,
    outcomeByEV,
    performanceTrend,
    confidenceTrend,
    recommendations
  };
}

// Calculate stats from signal array
function calculateStatsFromSignals(signals: SignalMemoryEntry[]): SignalMemoryStats {
  const totalSignals = signals.length;
  const executedTrades = signals.filter(s => s.tradeExecuted).length;
  const completedTrades = signals.filter(s => s.outcome && s.outcome !== "PENDING").length;
  const wins = signals.filter(s => s.outcome === "WIN").length;
  const losses = signals.filter(s => s.outcome === "LOSS").length;
  const pendingTrades = signals.filter(s => s.outcome === "PENDING").length;

  const evValues = signals.map(s => s.ev);
  const probabilityValues = signals.map(s => s.probability);
  const confidenceValues = signals.map(s => s.confidence);
  const pnlValues = signals.filter(s => s.profitLoss !== undefined).map(s => s.profitLoss!);

  return {
    totalSignals,
    executedTrades,
    completedTrades,
    wins,
    losses,
    pendingTrades,
    avgEV: evValues.length > 0 ? evValues.reduce((sum, ev) => sum + ev, 0) / evValues.length : 0,
    avgProbability: probabilityValues.length > 0 ? probabilityValues.reduce((sum, p) => sum + p, 0) / probabilityValues.length : 0,
    avgConfidence: confidenceValues.length > 0 ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length : 0,
    avgResolutionTime: 0,
    avgHoldDuration: 0,
    totalPnL: pnlValues.reduce((sum, pnl) => sum + pnl, 0),
    winRate: completedTrades > 0 ? (wins / completedTrades) * 100 : 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0
  };
}

// Calculate outcome by EV category
function calculateOutcomeByEV(signals: SignalMemoryEntry[]): {
  wins: number;
  losses: number;
  winRate: number;
} {
  const wins = signals.filter(s => s.outcome === "WIN").length;
  const losses = signals.filter(s => s.outcome === "LOSS").length;
  const completed = wins + losses;
  const winRate = completed > 0 ? (wins / completed) * 100 : 0;

  return { wins, losses, winRate };
}

// Calculate performance trend
function calculatePerformanceTrend(signals: SignalMemoryEntry[]): "IMPROVING" | "DECLINING" | "STABLE" {
  if (signals.length < 10) return "STABLE";

  const recent = signals.slice(0, 10);
  const older = signals.slice(10, 20);

  const recentWR = calculateWinRate(recent);
  const olderWR = calculateWinRate(older);

  if (recentWR > olderWR + 10) return "IMPROVING";
  if (recentWR < olderWR - 10) return "DECLINING";
  return "STABLE";
}

// Calculate confidence trend
function calculateConfidenceTrend(signals: SignalMemoryEntry[]): "IMPROVING" | "DECLINING" | "STABLE" {
  if (signals.length < 10) return "STABLE";

  const recent = signals.slice(0, 10);
  const older = signals.slice(10, 20);

  const recentConf = recent.reduce((sum, s) => sum + s.confidence, 0) / recent.length;
  const olderConf = older.reduce((sum, s) => sum + s.confidence, 0) / older.length;

  if (recentConf > olderConf + 5) return "IMPROVING";
  if (recentConf < olderConf - 5) return "DECLINING";
  return "STABLE";
}

// Calculate win rate
function calculateWinRate(signals: SignalMemoryEntry[]): number {
  const completed = signals.filter(s => s.outcome === "WIN" || s.outcome === "LOSS");
  if (completed.length === 0) return 0;
  const wins = completed.filter(s => s.outcome === "WIN").length;
  return (wins / completed.length) * 100;
}

// Generate recommendations
function generateRecommendations(
  stats: SignalMemoryStats,
  recentStats: SignalMemoryStats,
  outcomeByEV: SignalMemoryAnalysis['outcomeByEV']
): string[] {
  const recommendations: string[] = [];

  // Win rate recommendations
  if (stats.winRate < 50) {
    recommendations.push("Win rate below 50% - review signal quality and entry criteria");
  } else if (stats.winRate > 70) {
    recommendations.push("Excellent win rate - maintain current strategy");
  }

  // EV recommendations
  if (outcomeByEV.high.winRate < outcomeByEV.medium.winRate) {
    recommendations.push("High EV signals underperforming - consider reducing EV threshold");
  }

  if (outcomeByEV.negative.winRate > 30) {
    recommendations.push("Negative EV signals showing unexpected wins - review EV calculations");
  }

  // Recent performance recommendations
  if (recentStats.winRate < stats.winRate - 15) {
    recommendations.push("Recent performance declining - consider temporary pause");
  }

  // Confidence recommendations
  if (stats.avgConfidence < 60) {
    recommendations.push("Low average confidence - improve signal reliability");
  }

  // Resolution time recommendations
  if (stats.avgResolutionTime > 1440) { // > 24 hours
    recommendations.push("Long resolution times - consider shorter timeframes");
  }

  return recommendations;
}

// Clear signal memory
export function clearSignalMemory(): void {
  signalMemory = [];
}

// Get signal memory size
export function getSignalMemorySize(): number {
  return signalMemory.length;
}

// Get recent signals
export function getRecentSignals(count: number = 10): SignalMemoryEntry[] {
  return signalMemory.slice(0, count);
}
