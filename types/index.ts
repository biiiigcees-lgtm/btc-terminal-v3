// types/index.ts — Shared types for BTC Terminal v3

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  ema9: number;
  ema21: number;
  ema50: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  bbUpper: number;
  bbMid: number;
  bbLower: number;
  stochK: number;
  stochD: number;
  vwap: number;
  atr: number;
  momentum: number;
  williamsR: number;
  cci: number;
  cmf: number;
  // Multi-timeframe
  ema9_1h: number;
  ema21_1h: number;
  rsi_1h: number;
  ema9_4h: number;
  ema21_4h: number;
  rsi_4h: number;
}

export interface SignalResult {
  direction: "ABOVE" | "BELOW" | "WAIT";
  alphaScore: number;
  confidence: number;
  regime: "TREND" | "RANGE" | "VOLATILE" | "CHOPPY";
  regimeHold: number;
  kalshiEdge: "ABOVE" | "BELOW" | "NEUTRAL";
  kalshiConf: number;
  // NEW: Confidence tier
  confidenceTier: "DO_NOT_BET" | "MARGINAL" | "BET" | "HIGH_CONVICTION";
  // Multi-timeframe
  htfBias: "BULL" | "BEAR" | "NEUTRAL";
  htfAligned: boolean;
  // ATR gate
  atrGate: boolean; // true = safe to bet, false = too volatile
  // Time of day
  timeWindowGood: boolean;
  timeWindowLabel: string;
  // Indicators snapshot
  indicators: Partial<Indicators>;
  indicators_1h?: Partial<Indicators>;
  indicators_4h?: Partial<Indicators>;
  priceEntry: number;
  tp1: number;
  tp2: number;
  stopLoss: number;
  riskReward: number;
  atrValue: number;
  phase: "EARLY" | "MID" | "LATE";
  timestamp: number;
}

export interface MicrostructureData {
  tickVelocity: number;
  orderFlowImbalance: number;
  spreadExpansion: number;
  aggressorRatio: number;
  volatilityBurst: boolean;
  syntheticPrice: number;
  priceVelocity: number;
  volumeWeightedPrice: number;
}

export interface MarketData {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  fearGreed: number;
  fearGreedLabel: string;
  binance: number;
  coinbase: number;
  kraken: number;
  agg: number;
  candles_15m: Candle[];
  candles_1h: Candle[];
  candles_4h: Candle[];
  halvingDays: number;
  timestamp: number;
  microstructure?: MicrostructureData;
  syntheticPrice?: number;
  priceVelocity?: number;
  volumeWeightedPrice?: number;
}

export interface TradeLog {
  id: string;
  timestamp: number;
  direction: "ABOVE" | "BELOW";
  confidence: number;
  alphaScore: number;
  confidenceTier: string;
  result: "WIN" | "LOSS" | "PENDING";
  pnl: number;
  betSize: number;
  sessionId: string;
}

export interface SessionStats {
  sessionId: string;
  startTime: number;
  betsToday: number;
  wins: number;
  losses: number;
  pending: number;
  netPnl: number;
  winRate: number;
  bankroll: number;
  peakBankroll: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  isLocked: boolean;
  lockUntil: number | null;
  lockReason: string | null;
  hourlyStats: Record<number, { wins: number; losses: number; bets: number }>;
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  impliedProb: number;
  volume: number;
  expiresAt: string;
}

// ── Backtesting ───────────────────────────────────────────────────────────────
export interface BacktestTrade {
  time: number;
  direction: "ABOVE" | "BELOW";
  alpha: number;
  entryPrice: number;
  exitPrice: number;
  result: "WIN" | "LOSS";
  pnl: number;
}

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  maxDrawdown: number;
  peakPnl: number;
  byAlphaBracket: Record<string, { wins: number; losses: number; winRate: number; trades: number }>;
  byHour: Record<number, { wins: number; losses: number; winRate: number }>;
  trades: BacktestTrade[];
  bestHour: number;
  worstHour: number;
  bestAlphaBracket: string;
  sharpeRatio: number;
}

// ── Signal Accuracy Log ───────────────────────────────────────────────────────
export interface SignalAccuracyEntry {
  id: string;
  timestamp: number;
  direction: "ABOVE" | "BELOW" | "WAIT";
  alpha: number;
  confidenceTier: string;
  entryPrice: number;
  resolvedPrice: number | null;
  correct: boolean | null;
  resolved: boolean;
}

// ── Order Book ────────────────────────────────────────────────────────────────
export interface OrderBookLevel {
  price: number;
  qty: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bidWall: number;
  askWall: number;
  imbalance: number; // -1 to 1, positive = buy pressure
  spread: number;
  timestamp: number;
}

// ── Drawdown ──────────────────────────────────────────────────────────────────
export interface DrawdownStats {
  currentDrawdown: number;
  maxDrawdown: number;
  drawdownPct: number;
  peakBankroll: number;
  warningLevel: "NONE" | "CAUTION" | "WARNING" | "DANGER";
}

// ── Groq AI ───────────────────────────────────────────────────────────────────
export interface GroqSignalComment {
  reasoning: string;
  confidence: string;
  keyFactors: string[];
  timestamp: number;
}

// ── PnL Tracker ───────────────────────────────────────────────────────────────
export interface SimulatedTrade {
  id: string;
  timestamp: number;
  direction: "ABOVE" | "BELOW";
  entryPrice: number;
  exitPrice: number | null;
  alphaScore: number;
  confidenceTier: string;
  betSize: number;
  pnl: number | null;
  resolved: boolean;
  correct: boolean | null;
}

export interface SimulatedPnLStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnL: number;
  peakPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  equityCurve: { timestamp: number; pnl: number }[];
}

// ── Strategy & Weights ────────────────────────────────────────────────────────
export type StrategyMode = "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";

export interface AgentWeights {
  momentum: number;
  volatility: number;
  meanReversion: number;
  orderFlow: number;
  kalshi: number;
  lastUpdated: number;
  totalTrades: number;
}

export interface WeightOptimizationResult {
  currentWeights: AgentWeights;
  optimizedWeights: AgentWeights;
  improvement: number;
  confidence: number;
  basedOnTrades: number;
  insights: string[];
  performanceByBracket: Record<string, { accuracy: number; trades: number; weight: number }>;
}
