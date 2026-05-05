// app/api/decision-engine/route.ts — SINGLE DECISION SYSTEM: BEST TRADE or NO TRADE only

import { NextResponse } from "next/server";
import { calculateEnhancedAlpha } from "@/lib/alphaEngine";
import { calculateConsensus } from "@/lib/consensusEngine";
import { analyzeEV, createAlphaCandidate } from "@/lib/evEngine";
import { filterTrade, applyHardNoTradeRule } from "@/lib/tradeFilter";
import { selectBestTrade } from "@/lib/tradeSelector";
import { classifyTrade } from "@/lib/tradeClassification";
import { shouldUpdateSignal } from "@/lib/signalThrottling";
import { generateSignalReasons } from "@/lib/reasonEngine";
import { getConfidenceLevel } from "@/lib/confidenceLanguage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch market data
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const marketRes = await fetch(`${baseUrl}/api/market`, { cache: "no-store" });
    if (!marketRes.ok) throw new Error("Market fetch failed");
    const market = await marketRes.json();

    const { candles_15m, candles_1h, candles_4h, price, microstructure } = market;

    if (!candles_15m || candles_15m.length < 60) {
      return NextResponse.json({ 
        decisionEngine: createNoTradeDecision("Insufficient market data", ["Market data not available"])
      }, { status: 503 });
    }

    // Calculate indicators
    const indicators = await import("@/lib/indicators").then(m => m.calculateAllIndicators(candles_15m));
    if (!indicators) {
      return NextResponse.json({ 
        decisionEngine: createNoTradeDecision("Indicator calculation failed", ["Technical indicators failed"])
      }, { status: 500 });
    }

    // Run all engines
    const alpha = calculateEnhancedAlpha(candles_15m, candles_1h, candles_4h, market, null);
    if (!alpha) {
      return NextResponse.json({ 
        decisionEngine: createNoTradeDecision("Alpha calculation failed", ["Alpha engine failed"])
      }, { status: 500 });
    }

    const consensus = calculateConsensus(
      indicators,
      candles_15m,
      market,
      alpha,
      microstructure || {
        tickVelocity: 0,
        orderFlowImbalance: 0,
        spreadExpansion: 1,
        aggressorRatio: 0.5,
        volatilityBurst: false
      },
      null, null, {
        momentum: 0.25,
        volatility: 0.2,
        meanReversion: 0.2,
        orderFlow: 0.15,
        kalshi: 0.2,
        lastUpdated: Date.now(),
        totalTrades: 0
      }
    );

    let evAnalysis = null;
    if (alpha.direction !== "WAIT") {
      try {
        const candidate = createAlphaCandidate(alpha, price, indicators);
        evAnalysis = analyzeEV(candidate, (indicators.atr / price) * 100, 25);
      } catch (error) {
        console.error("EV analysis failed:", error);
      }
    }

    // Get Kalshi feasibility for ABSOLUTE SILENCE RULE
    let kalshiFeasibility = { feasible: false, score: 0 };
    try {
      const kalshiRes = await fetch(`${baseUrl}/api/kalshi`, { cache: "no-store" });
      if (kalshiRes.ok) {
        const kalshiData = await kalshiRes.json();
        // Check if any Kalshi round has good feasibility
        const bestKalshi = kalshiData.rounds?.find((r: any) => r.kalshiReality?.feasibilityScore > 70);
        if (bestKalshi) {
          kalshiFeasibility = {
            feasible: true,
            score: bestKalshi.kalshiReality.feasibilityScore
          };
        }
      }
    } catch (error) {
      console.error("Kalshi feasibility check failed:", error);
    }

    // Apply ABSOLUTE SILENCE RULE
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

    const silenceCheck = evAnalysis ? 
      applyHardNoTradeRule(evAnalysis, consensus, alpha, kalshiFeasibility) :
      { shouldTrade: false, reason: "NO EDGE", blockingRule: "NO_EV", details: ["No EV analysis"] };

    if (!silenceCheck.shouldTrade) {
      return NextResponse.json({
        decisionEngine: createNoTradeDecision("Market conditions not favorable", silenceCheck.details)
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Apply trade filter
    const filterResult = filterTrade(evAnalysis, alpha, consensus, indicators, market, sessionState);

    if (!filterResult.shouldTrade) {
      return NextResponse.json({
        decisionEngine: createNoTradeDecision("Trade filter rejected", filterResult.blockedBy)
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Select best trade (SINGLE DECISION SYSTEM)
    const selectionResult = selectBestTrade(
      alpha,
      consensus,
      [], // kalshiSignals
      indicators,
      market,
      sessionState,
      { minEV: 0.06, preferKalshi: false, riskTolerance: "MODERATE" }
    );

    if (!selectionResult.bestTrade) {
      return NextResponse.json({
        decisionEngine: createNoTradeDecision("No viable trades found", ["No trade passed selection"])
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Generate reasons
    const reasonAnalysis = generateSignalReasons(alpha, consensus, evAnalysis, indicators, market, filterResult);

    // Get confidence level
    const confidenceLevel = getConfidenceLevel(selectionResult.bestTrade.confidence);
    const tradeClass = classifyTrade(
      selectionResult.bestTrade.ev,
      selectionResult.bestTrade.probability,
      selectionResult.bestTrade.confidence
    );

    // Create SINGLE DECISION output
    const decisionEngine = createBestTradeDecision(
      selectionResult.bestTrade,
      confidenceLevel,
      tradeClass,
      reasonAnalysis,
      market
    );

    return NextResponse.json({
      decisionEngine,
      timestamp: Date.now()
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Decision Engine API error:", err);
    return NextResponse.json({ 
      decisionEngine: createNoTradeDecision("System error", ["API error"])
    }, { status: 500 });
  }
}

// Create NO TRADE decision (SINGLE DECISION SYSTEM)
function createNoTradeDecision(reason: string, details: string[]) {
  return {
    type: "NO_TRADE",
    title: "BTC DECISION ENGINE",
    status: "NO EDGE",
    reason,
    details,
    action: "DO NOTHING",
    actionColor: "#6b7280", // gray
    backgroundColor: "#1f2937", // dark gray
    borderColor: "#4b5563", // medium gray
    visualPriority: "GRAY",
    confidenceLevel: "NO EDGE",
    
    // Decision context
    marketCondition: "UNFAVORABLE",
    statisticalAdvantage: false,
    
    // Blocking factors
    blockingFactors: details,
    
    // Recommendations
    recommendation: "Wait for better conditions",
    patienceLevel: "HIGH",
    
    timestamp: Date.now()
  };
}

// Create BEST TRADE decision (SINGLE DECISION SYSTEM)
function createBestTradeDecision(
  bestTrade: any,
  confidenceLevel: any,
  tradeClass: any,
  reasonAnalysis: any,
  market: any
) {
  const direction = bestTrade.direction === "ABOVE" ? "BUY" : "SELL";
  const evDisplay = bestTrade.ev > 0 ? `+${bestTrade.ev.toFixed(3)}` : bestTrade.ev.toFixed(3);
  const kalshiEdge = bestTrade.kalshiEdge ? `+${bestTrade.kalshiEdge.toFixed(1)}%` : "N/A";
  
  return {
    type: "BEST_TRADE",
    title: "BTC DECISION ENGINE",
    status: "ACTIVE",
    direction,
    ev: evDisplay,
    probability: `${Math.round(bestTrade.probability)}%`,
    confidence: confidenceLevel.level,
    kalshiEdge,
    action: "VALID TRADE — CONSIDER ENTRY",
    actionColor: tradeClass.color,
    backgroundColor: tradeClass.backgroundColor,
    borderColor: tradeClass.borderColor,
    visualPriority: tradeClass.visualPriority,
    tradeClass: tradeClass.level,
    
    // Decision context
    marketCondition: "FAVORABLE",
    statisticalAdvantage: true,
    
    // Trade details
    entryPrice: bestTrade.entryPrice,
    targetPrice: bestTrade.targetPrice,
    stopLoss: bestTrade.stopLoss,
    riskReward: bestTrade.riskReward.toFixed(2),
    positionSize: bestTrade.positionSize,
    maxDrawdown: bestTrade.maxDrawdown,
    
    // Reasons (WHY explanation)
    primaryReason: reasonAnalysis.primaryReason.reason,
    supportingReasons: reasonAnalysis.supportingReasons.slice(0, 3).map((r: any) => r.reason),
    
    // Market context
    marketPrice: market.price,
    volatility: market.microstructure?.volatilityBurst ? "HIGH" : "NORMAL",
    regime: reasonAnalysis.primaryReason.category,
    
    // Risk factors
    riskFactors: reasonAnalysis.riskFactors.slice(0, 2),
    
    // Recommendations
    recommendation: "Consider entry if risk parameters align",
    patienceLevel: "MODERATE",
    
    timestamp: Date.now()
  };
}
