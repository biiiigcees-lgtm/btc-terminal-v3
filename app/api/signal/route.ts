// app/api/signal/route.ts — Integrated signal engine with all core components

import { NextResponse } from "next/server";
import type { SignalResult } from "@/types";
import { calculateAllIndicators, atrVolatilityGate, getTimeWindow } from "@/lib/indicators";
import { computeAlphaScore, getConfidenceTier, calcKellyBet } from "@/lib/scoring";
import { calculateEnhancedAlpha } from "@/lib/alphaEngine";
import { calculateConsensus } from "@/lib/consensusEngine";
import { analyzeEV, createAlphaCandidate } from "@/lib/evEngine";
import { filterTrade } from "@/lib/tradeFilter";
import { selectBestTrade } from "@/lib/tradeSelector";
import { createSignalLog, logSignal } from "@/lib/signalLogger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch all market data
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/market`, { cache: "no-store" });
    if (!res.ok) throw new Error("Market fetch failed");
    const market = await res.json();

    const { candles_15m, candles_1h, candles_4h, price, microstructure } = market;

    if (!candles_15m || candles_15m.length < 60) {
      return NextResponse.json({ error: "Insufficient candle data" }, { status: 503 });
    }

    // Calculate all indicators
    const ind = calculateAllIndicators(candles_15m);
    if (!ind) return NextResponse.json({ error: "Indicator calculation failed" }, { status: 500 });

    // Enhanced Alpha Score Engine with regime detection and microstructure
    const enhancedAlpha = calculateEnhancedAlpha(
      candles_15m,
      candles_1h,
      candles_4h,
      market,
      null // orderBook - would be fetched separately
    );

    if (!enhancedAlpha) {
      return NextResponse.json({ error: "Enhanced alpha calculation failed" }, { status: 500 });
    }

    // Consensus Engine with 5 agents
    const consensus = calculateConsensus(
      ind,
      candles_15m,
      market,
      enhancedAlpha,
      microstructure || {
        tickVelocity: 0,
        orderFlowImbalance: 0,
        spreadExpansion: 1,
        aggressorRatio: 0.5,
        volatilityBurst: false
      },
      null, // kalshiSignal
      null, // kalshiProbability
      {
        momentum: 0.25,
        volatility: 0.2,
        meanReversion: 0.2,
        orderFlow: 0.15,
        kalshi: 0.2,
        lastUpdated: Date.now(),
        totalTrades: 0
      }
    );

    // EV Engine analysis
    let evAnalysis = null;
    if (enhancedAlpha.direction !== "WAIT") {
      try {
        const candidate = createAlphaCandidate(enhancedAlpha, price, ind);
        evAnalysis = analyzeEV(candidate, (ind.atr / price) * 100, 25);
      } catch (error) {
        console.error("EV analysis failed:", error);
      }
    }

    // Trade Filter Engine
    const sessionState = {
      isLocked: false,
      lockReason: null,
      lockUntil: null,
      consecutiveLosses: 0,
      currentDrawdown: 0,
      dailyPnL: 0,
      weeklyPnL: 0,
      totalTrades: 0,
      lastTradeTime: 0,
      cooldownPeriod: 5,
      bankroll: 25
    };

    const filterResult = evAnalysis ? 
      filterTrade(evAnalysis, enhancedAlpha, consensus, ind, market, sessionState) :
      { shouldTrade: false, decision: "NO_TRADE" as const, confidence: 0, reasons: ["No EV analysis"], blockedBy: [], warnings: [], riskLevel: "LOW" as const, recommendation: "Wait for better setup", alternativeActions: [] };

    // Best Trade Selector (simplified for single signal)
    const selectionResult = evAnalysis ? 
      selectBestTrade(
        enhancedAlpha,
        consensus,
        [], // kalshiSignals
        ind,
        market,
        sessionState,
        { minEV: 0.02, preferKalshi: false, riskTolerance: "MODERATE" }
      ) :
      { bestTrade: null, alternatives: [], rejected: [], summary: { totalCandidates: 0, viableTrades: 0, averageEV: 0, bestEV: 0, riskLevel: "LOW" as const, recommendation: "No viable trades" }, marketContext: { volatility: "MEDIUM" as const, trend: "NEUTRAL" as const, liquidity: "GOOD" as const, sentiment: "NEUTRAL" as const } };

    // Create and log signal
    const signalLog = createSignalLog(
      enhancedAlpha,
      consensus,
      evAnalysis,
      filterResult,
      selectionResult,
      ind,
      market,
      null, // kalshiProbability
      "api-session"
    );

    // Log signal asynchronously (don't wait)
    logSignal(signalLog).catch(error => console.error("Signal logging failed:", error));

    // Legacy SignalResult for backward compatibility
    const atr = ind.atr;
    const atrMultTP1 = 1.0, atrMultTP2 = 2.0, atrMultStop = 0.8;
    const tp1 = enhancedAlpha.direction === "ABOVE" ? price + atr * atrMultTP1 : price - atr * atrMultTP1;
    const tp2 = enhancedAlpha.direction === "ABOVE" ? price + atr * atrMultTP2 : price - atr * atrMultTP2;
    const stopLoss = enhancedAlpha.direction === "ABOVE" ? price - atr * atrMultStop : price + atr * atrMultStop;
    const riskReward = Math.abs(tp1 - price) / Math.abs(stopLoss - price);

    // Apply confidence control - cap at 85%
    const cappedConfidence = Math.min(85, enhancedAlpha.confidence);
    const cappedKalshiConf = Math.min(85, consensus.confidence);
    const cappedProbability = evAnalysis ? Math.min(85, evAnalysis.candidate.probability) : 0;
    
    // SINGLE TRADE FOCUS - Only show best trade, no competing signals
    const bestTrade = evAnalysis && filterResult.shouldTrade ? {
      direction: enhancedAlpha.direction,
      ev: evAnalysis.ev.ev,
      probability: cappedProbability,
      confidence: cappedConfidence,
      entryPrice: price,
      targetPrice: enhancedAlpha.direction === "ABOVE" ? price + atr * 1.5 : price - atr * 1.5,
      stopLoss: enhancedAlpha.direction === "ABOVE" ? price - atr * 0.8 : price + atr * 0.8,
      riskReward: 1.5,
      alphaScore: enhancedAlpha.alphaScore,
      consensusStrength: consensus.strength,
      consensusAgreement: consensus.agreement,
      kellyFraction: evAnalysis.kellyFraction,
      maxDrawdown: evAnalysis.maxDrawdown,
      timeHorizon: evAnalysis.timeHorizon,
      tradeType: "SPOT",
      urgency: evAnalysis.timeHorizon < 30 ? "HIGH" : evAnalysis.timeHorizon < 60 ? "MEDIUM" : "LOW",
      quality: evAnalysis.ev.ev > 0.05 ? "EXCELLENT" : evAnalysis.ev.ev > 0.02 ? "GOOD" : "FAIR"
    } : null;

    const result: SignalResult = {
      // SINGLE TRADE FOCUS - Only one trade visible
      bestTrade,
      hasTrade: !!bestTrade,
      
      // Legacy compatibility (deprecated - use bestTrade instead)
      direction: bestTrade ? bestTrade.direction : "WAIT",
      alphaScore: enhancedAlpha.alphaScore,
      confidence: bestTrade ? bestTrade.confidence : 0,
      regime: enhancedAlpha.regime.regime,
      regimeHold: enhancedAlpha.regime.expectedDuration,
      kalshiEdge: consensus.direction === "ABOVE" || consensus.direction === "BELOW" ? consensus.direction : "NEUTRAL",
      kalshiConf: cappedKalshiConf,
      confidenceTier: consensus.strength > 70 ? "HIGH_CONVICTION" : consensus.strength > 50 ? "BET" : "MARGINAL",
      htfBias: consensus.direction === "ABOVE" ? "BULL" : consensus.direction === "BELOW" ? "BEAR" : "NEUTRAL",
      htfAligned: consensus.agreement > 60,
      atrGate: true,
      timeWindowGood: true,
      timeWindowLabel: "Current Window",
      indicators: {
        ema9: ind.ema9, ema21: ind.ema21, ema50: ind.ema50,
        rsi: ind.rsi, macd: ind.macd, macdSignal: ind.macdSignal,
        bbUpper: ind.bbUpper, bbMid: ind.bbMid, bbLower: ind.bbLower,
        stochK: ind.stochK, stochD: ind.stochD,
        vwap: ind.vwap, atr, momentum: ind.momentum,
        williamsR: ind.williamsR, cci: ind.cci, cmf: ind.cmf,
      },
      priceEntry: price,
      tp1, tp2, stopLoss, riskReward, atrValue: atr, 
      phase: "EARLY",
      timestamp: Date.now(),
      
      // Confidence control indicators
      confidenceCapped: enhancedAlpha.confidence > 85,
      kalshiConfidenceCapped: consensus.confidence > 85,
      probabilityCapped: evAnalysis ? evAnalysis.candidate.probability > 85 : false,
      originalConfidence: enhancedAlpha.confidence,
      originalKalshiConfidence: consensus.confidence,
      originalProbability: evAnalysis ? evAnalysis.candidate.probability : 0,
      
      // SINGLE TRADE FOCUS indicators
      singleTradeMode: true,
      competingSignalsRemoved: true,
      focusMode: "ELITE_DECISION"
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Signal API error:", err);
    return NextResponse.json({ error: "Signal computation failed" }, { status: 500 });
  }
}
