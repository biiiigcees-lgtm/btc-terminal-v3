// app/api/decision/route.ts — DECISION BOX centerpiece with Elite Decision Mode

import { NextResponse } from "next/server";
import { calculateEnhancedAlpha } from "@/lib/alphaEngine";
import { calculateConsensus } from "@/lib/consensusEngine";
import { analyzeEV, createAlphaCandidate } from "@/lib/evEngine";
import { filterTrade, applyHardNoTradeRule } from "@/lib/tradeFilter";
import { selectBestTrade } from "@/lib/tradeSelector";
import { classifyTrade } from "@/lib/tradeClassification";
import { shouldUpdateSignal, SignalState } from "@/lib/signalThrottling";
import { generateSignalReasons } from "@/lib/reasonEngine";

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
        decisionBox: createNoTradeDecisionBox("Insufficient market data")
      }, { status: 503 });
    }

    // Calculate indicators
    const indicators = await import("@/lib/indicators").then(m => m.calculateAllIndicators(candles_15m));
    if (!indicators) {
      return NextResponse.json({ 
        decisionBox: createNoTradeDecisionBox("Indicator calculation failed")
      }, { status: 500 });
    }

    // Run all engines
    const alpha = calculateEnhancedAlpha(candles_15m, candles_1h, candles_4h, market, null);
    if (!alpha) {
      return NextResponse.json({ 
        decisionBox: createNoTradeDecisionBox("Alpha calculation failed")
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

    // Apply HARD SILENCE MODE
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
      applyHardNoTradeRule(evAnalysis, consensus, alpha) :
      { shouldTrade: false, reason: "NO EDGE — WAIT", blockingRule: "NO_EV" };

    if (!silenceCheck.shouldTrade) {
      return NextResponse.json({
        decisionBox: createNoTradeDecisionBox("Market conditions unclear", "No statistical edge")
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Apply trade filter
    const filterResult = filterTrade(evAnalysis, alpha, consensus, indicators, market, sessionState);

    if (!filterResult.shouldTrade) {
      return NextResponse.json({
        decisionBox: createNoTradeDecisionBox(filterResult.blockedBy[0] || "Trade filtered out")
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Select best trade (SINGLE TRADE FOCUS)
    const selectionResult = selectBestTrade(
      alpha,
      consensus,
      [], // kalshiSignals
      indicators,
      market,
      sessionState,
      { minEV: 0.05, preferKalshi: false, riskTolerance: "MODERATE" }
    );

    if (!selectionResult.bestTrade) {
      return NextResponse.json({
        decisionBox: createNoTradeDecisionBox("No viable trades found")
      }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Generate reasons
    const reasonAnalysis = generateSignalReasons(alpha, consensus, evAnalysis, indicators, market, filterResult);

    // Get confidence language
    const confidenceLevel = getConfidenceLanguage(selectionResult.bestTrade.confidence);
    const tradeClass = classifyTrade(
      selectionResult.bestTrade.ev,
      selectionResult.bestTrade.probability,
      selectionResult.bestTrade.confidence
    );

    // Get visual priority color
    const visualColor = getVisualPriorityColor(tradeClass.level);

    // Create DECISION BOX
    const decisionBox = createTradeDecisionBox(
      selectionResult.bestTrade,
      confidenceLevel,
      tradeClass,
      visualColor,
      reasonAnalysis,
      market
    );

    return NextResponse.json({
      decisionBox,
      timestamp: Date.now()
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Decision Box API error:", err);
    return NextResponse.json({ 
      decisionBox: createNoTradeDecisionBox("System error")
    }, { status: 500 });
  }
}

// Create no-trade decision box
function createNoTradeDecisionBox(reason: string, subReason?: string) {
  return {
    type: "NO_TRADE",
    title: "NO TRADE",
    reason,
    subReason: subReason || "Insufficient statistical edge",
    action: "WAIT",
    actionColor: "#6b7280", // gray
    backgroundColor: "#1f2937", // dark gray
    borderColor: "#4b5563", // medium gray
    visualPriority: "GRAY",
    confidenceLevel: "NO EDGE",
    timestamp: Date.now()
  };
}

// Create trade decision box (centerpiece)
function createTradeDecisionBox(
  bestTrade: any,
  confidenceLevel: string,
  tradeClass: any,
  visualColor: string,
  reasonAnalysis: any,
  market: any
) {
  const direction = bestTrade.direction === "ABOVE" ? "BUY" : "SELL";
  const evDisplay = bestTrade.ev > 0 ? `+${bestTrade.ev.toFixed(3)}` : bestTrade.ev.toFixed(3);
  const kalshiEdge = bestTrade.kalshiEdge ? `+${bestTrade.kalshiEdge.toFixed(1)}%` : "N/A";
  
  return {
    type: "BEST_TRADE",
    title: "BEST TRADE RIGHT NOW",
    direction,
    ev: evDisplay,
    probability: `${Math.round(bestTrade.probability)}%`,
    confidence: confidenceLevel,
    kalshiEdge,
    action: "CONSIDER ENTRY",
    actionColor: visualColor,
    backgroundColor: tradeClass.backgroundColor,
    borderColor: tradeClass.borderColor,
    visualPriority: tradeClass.level,
    tradeClass: tradeClass.level,
    
    // Additional details
    entryPrice: bestTrade.entryPrice,
    targetPrice: bestTrade.targetPrice,
    stopLoss: bestTrade.stopLoss,
    riskReward: bestTrade.riskReward.toFixed(2),
    positionSize: bestTrade.positionSize,
    maxDrawdown: bestTrade.maxDrawdown,
    
    // Reasons (show top 3)
    reasons: reasonAnalysis.supportingReasons.slice(0, 3).map((r: any) => r.reason),
    primaryReason: reasonAnalysis.primaryReason.reason,
    
    // Market context
    marketPrice: market.price,
    volatility: (market.microstructure?.volatilityBurst ? "HIGH" : "NORMAL"),
    regime: reasonAnalysis.primaryReason.category,
    
    // Risk factors
    riskFactors: reasonAnalysis.riskFactors.slice(0, 2),
    
    timestamp: Date.now()
  };
}

// Get confidence language
function getConfidenceLanguage(confidence: number): "HIGH CONVICTION" | "MEDIUM" | "LOW" | "NO EDGE" {
  if (confidence >= 80) return "HIGH CONVICTION";
  if (confidence >= 65) return "MEDIUM";
  if (confidence >= 50) return "LOW";
  return "NO EDGE";
}

// Get visual priority color
function getVisualPriorityColor(tradeClass: string): string {
  switch (tradeClass) {
    case "HIGH_EDGE":
      return "#10b981"; // green
    case "MEDIUM":
      return "#f59e0b"; // yellow
    case "LOW":
      return "#6b7280"; // gray
    case "NO_TRADE":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}
