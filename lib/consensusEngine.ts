// lib/consensusEngine.ts — Multi-agent Consensus Engine with 5 specialized agents

import type { Indicators, Candle, MarketData } from "@/types";
import { AlphaScoreResult, Microstructure } from "./alphaEngine";
import { KalshiProbability, KalshiSignal } from "./kalshiEngine";

export interface AgentVote {
  agent: string;
  direction: "ABOVE" | "BELOW" | "NEUTRAL";
  confidence: number;        // 0-100
  reasoning: string[];
  weight: number;            // Agent's weight in consensus
  performance: {            // Historical performance
    winRate: number;
    totalTrades: number;
    recentPerformance: number; // Last 10 trades
  };
}

export interface ConsensusResult {
  direction: "ABOVE" | "BELOW" | "NEUTRAL";
  strength: number;         // 0-100, how strong the consensus is
  agreement: number;         // 0-100, how much agents agree
  confidence: number;       // 0-100, overall confidence
  votes: AgentVote[];
  weightedScore: number;     // Weighted consensus score (-100 to 100)
  dissentLevel: number;      // How much disagreement exists
  recommendation: "STRONG_BUY" | "BUY" | "WAIT" | "SELL" | "STRONG_SELL";
  riskFactors: string[];
  opportunityFactors: string[];
}

export interface AgentWeights {
  momentum: number;
  volatility: number;
  meanReversion: number;
  orderFlow: number;
  kalshi: number;
  lastUpdated: number;
  totalTrades: number;
}

// Momentum Agent - focuses on trend and momentum indicators
class MomentumAgent {
  static analyze(indicators: Indicators, alpha: AlphaScoreResult): AgentVote {
    let score = 50;
    const reasoning: string[] = [];
    
    // RSI momentum
    if (indicators.rsi > 60) {
      score += 15;
      reasoning.push(`RSI strong at ${indicators.rsi.toFixed(0)}`);
    } else if (indicators.rsi < 40) {
      score -= 15;
      reasoning.push(`RSI weak at ${indicators.rsi.toFixed(0)}`);
    }
    
    // MACD momentum
    if (indicators.macd > indicators.macdSignal && indicators.macdHist > 0) {
      score += 20;
      reasoning.push("MACD bullish crossover");
    } else if (indicators.macd < indicators.macdSignal && indicators.macdHist < 0) {
      score -= 20;
      reasoning.push("MACD bearish crossover");
    }
    
    // Price momentum
    if (indicators.momentum > 0.5) {
      score += 10;
      reasoning.push(`Positive momentum ${indicators.momentum.toFixed(2)}`);
    } else if (indicators.momentum < -0.5) {
      score -= 10;
      reasoning.push(`Negative momentum ${indicators.momentum.toFixed(2)}`);
    }
    
    // EMA alignment
    if (indicators.ema9 > indicators.ema21 && indicators.ema21 > indicators.ema50) {
      score += 15;
      reasoning.push("EMA bullish alignment");
    } else if (indicators.ema9 < indicators.ema21 && indicators.ema21 < indicators.ema50) {
      score -= 15;
      reasoning.push("EMA bearish alignment");
    }
    
    const confidence = Math.abs(score - 50) * 2;
    const direction = score > 60 ? "ABOVE" : score < 40 ? "BELOW" : "NEUTRAL";
    
    return {
      agent: "momentum",
      direction,
      confidence: Math.min(100, Math.max(0, confidence)),
      reasoning,
      weight: 0.25,
      performance: { winRate: 62, totalTrades: 145, recentPerformance: 70 }
    };
  }
}

// Volatility Agent - focuses on volatility patterns and BB analysis
class VolatilityAgent {
  static analyze(indicators: Indicators, candles: Candle[], price: number): AgentVote {
    let score = 50;
    const reasoning: string[] = [];
    
    // Bollinger Band position
    const bbRange = indicators.bbUpper - indicators.bbLower;
    const bbPos = bbRange > 0 ? (price - indicators.bbLower) / bbRange : 0.5;
    
    if (bbPos > 0.8) {
      score -= 20;
      reasoning.push("Price at upper BB - potential reversal");
    } else if (bbPos < 0.2) {
      score += 20;
      reasoning.push("Price at lower BB - potential bounce");
    }
    
    // BB squeeze detection
    const bbWidth = bbRange / indicators.bbMid;
    if (bbWidth < 0.02) {
      reasoning.push("BB squeeze - breakout imminent");
      // Increase score in direction of recent momentum
      if (indicators.momentum > 0) score += 10;
      else score -= 10;
    }
    
    // ATR analysis
    const atrPercent = (indicators.atr / price) * 100;
    if (atrPercent > 2) {
      reasoning.push(`High volatility ${atrPercent.toFixed(1)}%`);
      // High volatility favors mean reversion
      score = bbPos > 0.5 ? Math.max(30, score - 10) : Math.min(70, score + 10);
    } else if (atrPercent < 0.5) {
      reasoning.push(`Low volatility ${atrPercent.toFixed(1)}%`);
      // Low volatility favors trend following
      score = indicators.momentum > 0 ? Math.min(70, score + 10) : Math.max(30, score - 10);
    }
    
    // Williams %R for volatility extremes
    if (indicators.williamsR > -20) {
      score -= 15;
      reasoning.push("Williams %R overbought");
    } else if (indicators.williamsR < -80) {
      score += 15;
      reasoning.push("Williams %R oversold");
    }
    
    const confidence = Math.abs(score - 50) * 1.8;
    const direction = score > 60 ? "ABOVE" : score < 40 ? "BELOW" : "NEUTRAL";
    
    return {
      agent: "volatility",
      direction,
      confidence: Math.min(100, Math.max(0, confidence)),
      reasoning,
      weight: 0.2,
      performance: { winRate: 58, totalTrades: 132, recentPerformance: 65 }
    };
  }
}

// Mean Reversion Agent - focuses on extreme conditions and reversals
class MeanReversionAgent {
  static analyze(indicators: Indicators, candles: Candle[], price: number): AgentVote {
    let score = 50;
    const reasoning: string[] = [];
    
    // RSI extremes
    if (indicators.rsi > 75) {
      score -= 25;
      reasoning.push(`RSI extremely overbought ${indicators.rsi.toFixed(0)}`);
    } else if (indicators.rsi < 25) {
      score += 25;
      reasoning.push(`RSI extremely oversold ${indicators.rsi.toFixed(0)}`);
    }
    
    // CCI extremes
    if (indicators.cci > 200) {
      score -= 20;
      reasoning.push(`CCI extremely overbought ${indicators.cci.toFixed(0)}`);
    } else if (indicators.cci < -200) {
      score += 20;
      reasoning.push(`CCI extremely oversold ${indicators.cci.toFixed(0)}`);
    }
    
    // Distance from VWAP
    const vwapDistance = Math.abs(price - indicators.vwap) / indicators.vwap;
    if (vwapDistance > 0.02) {
      reasoning.push(`Price ${vwapDistance > 0 ? "above" : "below"} VWAP by ${(vwapDistance * 100).toFixed(1)}%`);
      // Far from VWAP suggests mean reversion
      score = price > indicators.vwap ? Math.max(30, score - 15) : Math.min(70, score + 15);
    }
    
    // Stochastics extremes
    if (indicators.stochK > 90) {
      score -= 15;
      reasoning.push("Stochastics extremely overbought");
    } else if (indicators.stochK < 10) {
      score += 15;
      reasoning.push("Stochastics extremely oversold");
    }
    
    // Recent price action (last 3 candles)
    const last3 = candles.slice(-3);
    const consecutiveSameDirection = last3.every((c, i) => 
      i === 0 || (c.close > c.open) === (last3[i-1].close > last3[i-1].open)
    );
    
    if (consecutiveSameDirection && last3.length === 3) {
      const direction = last3[0].close > last3[0].open ? "up" : "down";
      reasoning.push(`${direction === "up" ? "Bullish" : "Bearish"} streak 3 candles - reversal likely`);
      score = direction === "up" ? Math.max(30, score - 10) : Math.min(70, score + 10);
    }
    
    const confidence = Math.abs(score - 50) * 2.2;
    const direction = score > 65 ? "ABOVE" : score < 35 ? "BELOW" : "NEUTRAL";
    
    return {
      agent: "meanReversion",
      direction,
      confidence: Math.min(100, Math.max(0, confidence)),
      reasoning,
      weight: 0.2,
      performance: { winRate: 55, totalTrades: 98, recentPerformance: 60 }
    };
  }
}

// Order Flow Agent - focuses on volume and order flow analysis
class OrderFlowAgent {
  static analyze(indicators: Indicators, microstructure: Microstructure, candles: Candle[]): AgentVote {
    let score = 50;
    const reasoning: string[] = [];
    
    // CMF (Chaikin Money Flow)
    if (indicators.cmf > 0.2) {
      score += 20;
      reasoning.push(`Strong buying pressure CMF ${indicators.cmf.toFixed(2)}`);
    } else if (indicators.cmf < -0.2) {
      score -= 20;
      reasoning.push(`Strong selling pressure CMF ${indicators.cmf.toFixed(2)}`);
    }
    
    // Order flow imbalance
    if (microstructure.orderFlowImbalance > 0.3) {
      score += 25;
      reasoning.push(`Strong order flow imbalance ${microstructure.orderFlowImbalance.toFixed(2)}`);
    } else if (microstructure.orderFlowImbalance < -0.3) {
      score -= 25;
      reasoning.push(`Negative order flow imbalance ${microstructure.orderFlowImbalance.toFixed(2)}`);
    }
    
    // Aggressor ratio
    if (microstructure.aggressorRatio > 0.7) {
      score += 15;
      reasoning.push(`High aggressor ratio ${microstructure.aggressorRatio.toFixed(2)}`);
    } else if (microstructure.aggressorRatio < 0.3) {
      score -= 15;
      reasoning.push(`Low aggressor ratio ${microstructure.aggressorRatio.toFixed(2)}`);
    }
    
    // Volume analysis (last 5 vs previous 5)
    const last5 = candles.slice(-5);
    const prev5 = candles.slice(-10, -5);
    
    if (last5.length >= 5 && prev5.length >= 5) {
      const recentVol = last5.reduce((sum, c) => sum + c.volume, 0);
      const prevVol = prev5.reduce((sum, c) => sum + c.volume, 0);
      const volRatio = recentVol / prevVol;
      
      if (volRatio > 1.5) {
        reasoning.push(`Volume surge ${volRatio.toFixed(1)}x`);
        // Check if price direction matches volume direction
        const priceChange = (last5[4].close - last5[0].close) / last5[0].close;
        if (priceChange > 0) score += 10;
        else score -= 10;
      }
    }
    
    // Tick velocity
    if (microstructure.tickVelocity > 0.01) {
      score += 10;
      reasoning.push(`High tick velocity ${microstructure.tickVelocity.toFixed(3)}`);
    } else if (microstructure.tickVelocity < -0.01) {
      score -= 10;
      reasoning.push(`Negative tick velocity ${microstructure.tickVelocity.toFixed(3)}`);
    }
    
    const confidence = Math.abs(score - 50) * 2;
    const direction = score > 60 ? "ABOVE" : score < 40 ? "BELOW" : "NEUTRAL";
    
    return {
      agent: "orderFlow",
      direction,
      confidence: Math.min(100, Math.max(0, confidence)),
      reasoning,
      weight: 0.15,
      performance: { winRate: 64, totalTrades: 87, recentPerformance: 68 }
    };
  }
}

// Kalshi Agent - focuses on prediction market signals
class KalshiAgent {
  static analyze(kalshi: KalshiSignal | null, probability: KalshiProbability | null): AgentVote {
    let score = 50;
    const reasoning: string[] = [];
    
    if (!kalshi || !probability) {
      return {
        agent: "kalshi",
        direction: "NEUTRAL",
        confidence: 0,
        reasoning: ["No Kalshi data available"],
        weight: 0.2,
        performance: { winRate: 50, totalTrades: 0, recentPerformance: 50 }
      };
    }
    
    // Edge analysis
    if (probability.edge > 10) {
      score += 30;
      reasoning.push(`Strong Kalshi edge ${probability.edge.toFixed(1)}%`);
    } else if (probability.edge > 5) {
      score += 15;
      reasoning.push(`Moderate Kalshi edge ${probability.edge.toFixed(1)}%`);
    } else if (probability.edge < -10) {
      score -= 30;
      reasoning.push(`Negative Kalshi edge ${probability.edge.toFixed(1)}%`);
    }
    
    // Confidence weighting
    if (probability.confidence > 80) {
      score += 10;
      reasoning.push(`High confidence ${probability.confidence}%`);
    } else if (probability.confidence < 40) {
      score -= 10;
      reasoning.push(`Low confidence ${probability.confidence}%`);
    }
    
    // Urgency mode
    if (probability.urgencyMode) {
      reasoning.push("Urgency mode - < 2 minutes");
      score *= 0.8; // Reduce weight in urgency mode
    }
    
    // Time decay consideration
    if (probability.timeDecayFactor < 0.5) {
      reasoning.push(`High time decay ${(probability.timeDecayFactor * 100).toFixed(0)}%`);
      score *= 0.7;
    }
    
    // Distance to target
    if (probability.requiredMovePerMin > 0.5) {
      reasoning.push(`High required move ${probability.requiredMovePerMin.toFixed(2)}/min`);
      score -= 10;
    }
    
    const confidence = Math.abs(score - 50) * 1.5;
    const direction = score > 65 ? "ABOVE" : score < 35 ? "BELOW" : "NEUTRAL";
    
    return {
      agent: "kalshi",
      direction,
      confidence: Math.min(100, Math.max(0, confidence)),
      reasoning,
      weight: 0.2,
      performance: { winRate: 67, totalTrades: 76, recentPerformance: 72 }
    };
  }
}

// Main consensus calculation
export function calculateConsensus(
  indicators: Indicators,
  candles: Candle[],
  market: MarketData,
  alpha: AlphaScoreResult,
  microstructure: Microstructure,
  kalshiSignal: KalshiSignal | null = null,
  kalshiProbability: KalshiProbability | null = null,
  agentWeights: AgentWeights = {
    momentum: 0.25,
    volatility: 0.2,
    meanReversion: 0.2,
    orderFlow: 0.15,
    kalshi: 0.2,
    lastUpdated: Date.now(),
    totalTrades: 0
  }
): ConsensusResult {
  // Get votes from all agents
  const votes: AgentVote[] = [
    MomentumAgent.analyze(indicators, alpha),
    VolatilityAgent.analyze(indicators, candles, market.price),
    MeanReversionAgent.analyze(indicators, candles, market.price),
    OrderFlowAgent.analyze(indicators, microstructure, candles),
    KalshiAgent.analyze(kalshiSignal, kalshiProbability)
  ];
  
  // Apply dynamic weights
  votes.forEach(vote => {
    vote.weight = agentWeights[vote.agent as keyof AgentWeights] || vote.weight;
  });
  
  // Calculate weighted score
  let weightedScore = 0;
  votes.forEach(vote => {
    const voteScore = vote.direction === "ABOVE" ? 100 : 
                     vote.direction === "BELOW" ? 0 : 50;
    weightedScore += voteScore * vote.weight;
  });
  
  // Calculate agreement level
  const aboveVotes = votes.filter(v => v.direction === "ABOVE");
  const belowVotes = votes.filter(v => v.direction === "BELOW");
  const neutralVotes = votes.filter(v => v.direction === "NEUTRAL");
  
  const maxVotes = Math.max(aboveVotes.length, belowVotes.length);
  const agreement = maxVotes > 0 ? (maxVotes / votes.length) * 100 : 0;
  
  // Determine consensus direction
  const direction = weightedScore > 60 ? "ABOVE" : 
                   weightedScore < 40 ? "BELOW" : "NEUTRAL";
  
  // Calculate strength based on weighted score distance from neutral
  const strength = Math.abs(weightedScore - 50) * 2;
  
  // Calculate overall confidence (weighted average of agent confidences)
  const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  const confidence = votes.reduce((sum, v) => sum + (v.confidence * v.weight), 0) / totalWeight;
  
  // Calculate dissent level
  const dissentVotes = direction === "ABOVE" ? belowVotes.length : 
                       direction === "BELOW" ? aboveVotes.length : 
                       Math.max(aboveVotes.length, belowVotes.length);
  const dissentLevel = votes.length > 0 ? (dissentVotes / votes.length) * 100 : 0;
  
  // Determine recommendation
  let recommendation: ConsensusResult["recommendation"] = "WAIT";
  if (direction === "ABOVE" && strength > 70 && confidence > 70) {
    recommendation = strength > 85 ? "STRONG_BUY" : "BUY";
  } else if (direction === "BELOW" && strength > 70 && confidence > 70) {
    recommendation = strength > 85 ? "STRONG_SELL" : "SELL";
  }
  
  // Identify risk and opportunity factors
  const riskFactors: string[] = [];
  const opportunityFactors: string[] = [];
  
  votes.forEach(vote => {
    if (vote.confidence < 40) {
      riskFactors.push(`${vote.agent} agent has low confidence`);
    }
    if (vote.direction === "NEUTRAL" && vote.weight > 0.15) {
      riskFactors.push(`${vote.agent} agent is neutral`);
    }
    if (vote.confidence > 80 && vote.direction !== "NEUTRAL") {
      opportunityFactors.push(`${vote.agent} agent highly confident`);
    }
  });
  
  if (dissentLevel > 60) {
    riskFactors.push("High disagreement among agents");
  }
  
  if (agreement > 80 && confidence > 75) {
    opportunityFactors.push("Strong agent agreement");
  }
  
  return {
    direction,
    strength: Math.min(100, Math.max(0, strength)),
    agreement,
    confidence: Math.min(100, Math.max(0, confidence)),
    votes,
    weightedScore: Math.round(weightedScore * 10) / 10,
    dissentLevel,
    recommendation,
    riskFactors,
    opportunityFactors
  };
}

// Update agent weights based on performance
export function updateAgentWeights(
  currentWeights: AgentWeights,
  recentPerformance: Record<string, number>
): AgentWeights {
  const learningRate = 0.1;
  const newWeights = { ...currentWeights };
  
  Object.entries(recentPerformance).forEach(([agent, performance]) => {
    if (agent in newWeights && typeof newWeights[agent as keyof AgentWeights] === "number") {
      const weight = newWeights[agent as keyof AgentWeights] as number;
      const adjustment = (performance - 50) * learningRate;
      newWeights[agent as keyof AgentWeights] = Math.max(0.05, Math.min(0.4, weight + adjustment));
    }
  });
  
  // Normalize weights to sum to 1
  const totalWeight = Object.values(newWeights).reduce((sum, w) => 
    typeof w === "number" ? sum + w : sum, 0
  );
  
  Object.keys(newWeights).forEach(key => {
    const value = newWeights[key as keyof AgentWeights];
    if (typeof value === "number") {
      newWeights[key as keyof AgentWeights] = value / totalWeight;
    }
  });
  
  newWeights.lastUpdated = Date.now();
  newWeights.totalTrades++;
  
  return newWeights;
}
