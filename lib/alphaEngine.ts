// lib/alphaEngine.ts — Enhanced Alpha Score Engine with dynamic weights and regime detection

import type { Indicators, Candle, MarketData } from "@/types";
import { calculateAllIndicators, atrVolatilityGate, getTimeWindow, calcHTFBias } from "./indicators";

export interface Microstructure {
  tickVelocity: number;        // Price change velocity over last 5 ticks
  orderFlowImbalance: number;  // Buy vs sell volume imbalance (-1 to 1)
  spreadExpansion: number;     // Current spread relative to average
  aggressorRatio: number;      // Market aggressor ratio
  volatilityBurst: boolean;     // Sudden volatility spike detected
}

export interface RegimeDetection {
  regime: "TREND" | "RANGE" | "VOLATILE" | "CHOPPY";
  strength: number;            // 0-100, how strong the regime is
  duration: number;           // How long regime has persisted (minutes)
  expectedDuration: number;    // Expected remaining duration (minutes)
}

export interface AlphaScoreResult {
  alphaScore: number;          // 0-100
  direction: "ABOVE" | "BELOW" | "WAIT";
  confidence: number;          // 0-100
  regime: RegimeDetection;
  microstructure: Microstructure;
  weights: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
    microstructure: number;
  };
  breakdown: {
    trend: number;
    momentum: number;
    flow: number;
    volatility: number;
    htf: number;
    micro: number;
  };
  signals: string[];
}

// Dynamic weight adjustment based on market conditions
function getDynamicWeights(regime: RegimeDetection, atrGate: boolean): AlphaScoreResult['weights'] {
  const base = {
    trend: 0.25,
    momentum: 0.25,
    volatility: 0.2,
    volume: 0.15,
    microstructure: 0.15
  };

  // Adjust weights based on regime
  switch (regime.regime) {
    case "TREND":
      return { ...base, trend: 0.35, momentum: 0.25, volume: 0.2, volatility: 0.1, microstructure: 0.1 };
    case "RANGE":
      return { ...base, trend: 0.15, momentum: 0.2, volatility: 0.3, volume: 0.2, microstructure: 0.15 };
    case "VOLATILE":
      return { ...base, trend: 0.1, momentum: 0.15, volatility: 0.35, volume: 0.25, microstructure: 0.15 };
    case "CHOPPY":
      return { ...base, trend: 0.15, momentum: 0.15, volatility: 0.2, volume: 0.25, microstructure: 0.25 };
    default:
      return base;
  }
}

// Calculate microstructure indicators
function calculateMicrostructure(candles: Candle[], orderBook?: any): Microstructure {
  const last5 = candles.slice(-5);
  
  // Tick velocity - rate of price change
  const priceChanges = last5.map((c, i) => i > 0 ? c.close - last5[i-1].close : 0);
  const avgVelocity = priceChanges.reduce((a, b) => a + Math.abs(b), 0) / 4;
  
  // Order flow imbalance
  const bullVolume = last5.filter(c => c.close >= c.open).reduce((a, c) => a + c.volume, 0);
  const bearVolume = last5.filter(c => c.close < c.open).reduce((a, c) => a + c.volume, 0);
  const totalVolume = bullVolume + bearVolume;
  const orderFlowImbalance = totalVolume > 0 ? (bullVolume - bearVolume) / totalVolume : 0;
  
  // Spread expansion (simplified - using high-low range as proxy)
  const currentSpread = last5[last5.length - 1].high - last5[last5.length - 1].low;
  const avgSpread = last5.slice(0, 4).reduce((a, c) => a + (c.high - c.low), 0) / 4;
  const spreadExpansion = avgSpread > 0 ? currentSpread / avgSpread : 1;
  
  // Aggressor ratio (simplified - using volume weighted price direction)
  const vwapChanges = last5.map((c, i) => {
    const vwap = (c.high + c.low + c.close) / 3;
    return i > 0 ? vwap - ((last5[i-1].high + last5[i-1].low + last5[i-1].close) / 3) : 0;
  });
  const aggressorRatio = vwapChanges.filter(v => v > 0).length / 4;
  
  // Volatility burst detection
  const atrs = last5.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = last5[i-1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  const currentATR = atrs[atrs.length - 1];
  const avgATR = atrs.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const volatilityBurst = currentATR > avgATR * 1.5;
  
  return {
    tickVelocity: avgVelocity,
    orderFlowImbalance,
    spreadExpansion,
    aggressorRatio,
    volatilityBurst
  };
}

// Detect market regime
function detectRegime(candles: Candle[], indicators: Indicators, atrGate: boolean): RegimeDetection {
  const emaSpread = Math.abs(indicators.ema9 - indicators.ema21) / candles[candles.length - 1].close;
  const rsi = indicators.rsi;
  const bbWidth = (indicators.bbUpper - indicators.bbLower) / indicators.bbMid;
  
  let regime: RegimeDetection['regime'];
  let strength = 50;
  
  if (!atrGate) {
    regime = "VOLATILE";
    strength = 80;
  } else if (emaSpread > 0.005) {
    regime = "TREND";
    strength = Math.min(90, emaSpread * 10000);
  } else if (rsi > 40 && rsi < 60 && bbWidth < 0.02) {
    regime = "RANGE";
    strength = Math.max(60, 80 - bbWidth * 1000);
  } else {
    regime = "CHOPPY";
    strength = 40;
  }
  
  // Estimate regime duration (simplified)
  const duration = 30; // minutes - would need more sophisticated tracking
  const expectedDuration = regime === "TREND" ? 120 : regime === "RANGE" ? 90 : 45;
  
  return {
    regime,
    strength,
    duration,
    expectedDuration
  };
}

// Calculate enhanced alpha score
export function calculateEnhancedAlpha(
  candles_15m: Candle[],
  candles_1h: Candle[],
  candles_4h: Candle[],
  market: MarketData,
  orderBook?: any
): AlphaScoreResult | null {
  if (candles_15m.length < 60) return null;
  
  const indicators = calculateAllIndicators(candles_15m);
  if (!indicators) return null;
  
  const price = market.price;
  const atrGate = atrVolatilityGate(candles_15m);
  const timeWindow = getTimeWindow(new Date().getUTCHours());
  const htfBias = calcHTFBias(candles_1h, candles_4h);
  
  // Calculate microstructure
  const microstructure = calculateMicrostructure(candles_15m, orderBook);
  
  // Detect regime
  const regime = detectRegime(candles_15m, indicators, atrGate);
  
  // Get dynamic weights
  const weights = getDynamicWeights(regime, atrGate);
  
  // Calculate component scores
  let bullScore = 0, bearScore = 0;
  const signals: string[] = [];
  
  // TREND SCORE (adjusted by weight)
  if (indicators.ema9 > indicators.ema21) { 
    bullScore += 10 * weights.trend / 0.25; 
    signals.push("EMA9>21 ▲"); 
  } else { 
    bearScore += 10 * weights.trend / 0.25; 
    signals.push("EMA9<21 ▽"); 
  }
  
  if (indicators.ema21 > indicators.ema50) { 
    bullScore += 10 * weights.trend / 0.25; 
    signals.push("EMA21>50 ▲"); 
  } else { 
    bearScore += 10 * weights.trend / 0.25; 
    signals.push("EMA21<50 ▽"); 
  }
  
  if (price > indicators.vwap) { 
    bullScore += 10 * weights.trend / 0.25; 
    signals.push("Above VWAP ▲"); 
  } else { 
    bearScore += 10 * weights.trend / 0.25; 
    signals.push("Below VWAP ▽"); 
  }
  
  // MOMENTUM SCORE (adjusted by weight)
  if (indicators.rsi > 55 && indicators.rsi < 75) { 
    bullScore += 8 * weights.momentum / 0.25; 
    signals.push(`RSI ${indicators.rsi.toFixed(0)} ▲`); 
  } else if (indicators.rsi < 45 && indicators.rsi > 25) { 
    bearScore += 8 * weights.momentum / 0.25; 
    signals.push(`RSI ${indicators.rsi.toFixed(0)} ▽`); 
  } else if (indicators.rsi >= 75) { 
    bearScore += 4 * weights.momentum / 0.25; 
    signals.push("RSI Overbought ▽"); 
  } else if (indicators.rsi <= 25) { 
    bullScore += 4 * weights.momentum / 0.25; 
    signals.push("RSI Oversold ▲"); 
  }
  
  if (indicators.stochK > 50 && indicators.stochK > indicators.stochD) { 
    bullScore += 6 * weights.momentum / 0.25; 
    signals.push("Stoch Bull ▲"); 
  } else if (indicators.stochK < 50 && indicators.stochK < indicators.stochD) { 
    bearScore += 6 * weights.momentum / 0.25; 
    signals.push("Stoch Bear ▽"); 
  }
  
  // FLOW SCORE (adjusted by weight)
  if (indicators.macd > indicators.macdSignal && indicators.macdHist > 0) { 
    bullScore += 10 * weights.volume / 0.15; 
    signals.push("MACD Bull Cross ▲"); 
  } else if (indicators.macd < indicators.macdSignal && indicators.macdHist < 0) { 
    bearScore += 10 * weights.volume / 0.15; 
    signals.push("MACD Bear Cross ▽"); 
  }
  
  if (indicators.cmf > 0.1) { 
    bullScore += 8 * weights.volume / 0.15; 
    signals.push(`CMF ${indicators.cmf.toFixed(2)} Bull ▲`); 
  } else if (indicators.cmf < -0.1) { 
    bearScore += 8 * weights.volume / 0.15; 
    signals.push(`CMF ${indicators.cmf.toFixed(2)} Bear ▽`); 
  }
  
  // VOLATILITY SCORE (adjusted by weight)
  const bbRange = indicators.bbUpper - indicators.bbLower;
  const bbPos = bbRange > 0 ? (price - indicators.bbLower) / bbRange : 0.5;
  if (bbPos > 0.8) { 
    bearScore += 8 * weights.volatility / 0.2; 
    signals.push("BB Upper ▽"); 
  } else if (bbPos < 0.2) { 
    bullScore += 8 * weights.volatility / 0.2; 
    signals.push("BB Lower ▲"); 
  }
  
  // MICROSTRUCTURE SCORE (adjusted by weight)
  if (microstructure.orderFlowImbalance > 0.2) { 
    bullScore += 8 * weights.microstructure / 0.15; 
    signals.push("Order Flow Bull ▲"); 
  } else if (microstructure.orderFlowImbalance < -0.2) { 
    bearScore += 8 * weights.microstructure / 0.15; 
    signals.push("Order Flow Bear ▽"); 
  }
  
  if (microstructure.aggressorRatio > 0.6) { 
    bullScore += 5 * weights.microstructure / 0.15; 
    signals.push("Aggressor Bull ▲"); 
  } else if (microstructure.aggressorRatio < 0.4) { 
    bearScore += 5 * weights.microstructure / 0.15; 
    signals.push("Aggressor Bear ▽"); 
  }
  
  // HTF SCORE
  let htfScore = 0;
  if (htfBias === "BULL") { 
    bullScore += 20; 
    htfScore = 20; 
    signals.push("HTF Bias BULL ▲▲"); 
  } else if (htfBias === "BEAR") { 
    bearScore += 20; 
    htfScore = 20; 
    signals.push("HTF Bias BEAR ▽▽"); 
  }
  
  // Calculate final alpha
  const maxPossible = 120;
  const net = bullScore - bearScore;
  const rawAlpha = Math.round(((net + maxPossible) / (maxPossible * 2)) * 100);
  const alphaScore = Math.max(0, Math.min(100, rawAlpha));
  
  // Direction requires minimum alpha
  let direction: "ABOVE" | "BELOW" | "WAIT" = "WAIT";
  if (alphaScore >= 65 && bullScore > bearScore) direction = "ABOVE";
  else if (alphaScore <= 35 && bearScore > bullScore) direction = "BELOW";
  
  // Confidence based on regime strength and signal alignment
  const confidence = Math.round((regime.strength * 0.6 + alphaScore * 0.4));
  
  return {
    alphaScore,
    direction,
    confidence,
    regime,
    microstructure,
    weights,
    breakdown: {
      trend: Math.round((bullScore > bearScore ? bullScore : bearScore) * weights.trend),
      momentum: Math.round((bullScore > bearScore ? bullScore : bearScore) * weights.momentum),
      flow: Math.round((bullScore > bearScore ? bullScore : bearScore) * weights.volume),
      volatility: Math.round((bullScore > bearScore ? bullScore : bearScore) * weights.volatility),
      htf: htfScore,
      micro: Math.round((bullScore > bearScore ? bullScore : bearScore) * weights.microstructure),
    },
    signals
  };
}
