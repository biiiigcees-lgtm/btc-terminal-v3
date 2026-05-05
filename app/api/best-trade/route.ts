// app/api/best-trade/route.ts — BEST TRADE PANEL - Main focus with Direction, EV, Probability, Reason

import { NextResponse } from "next/server";
import { calculateEnhancedAlpha } from "@/lib/alphaEngine";
import { calculateConsensus } from "@/lib/consensusEngine";
import { analyzeEV, createAlphaCandidate } from "@/lib/evEngine";
import { filterTrade, applyHardNoTradeRule } from "@/lib/tradeFilter";
import { selectBestTrade } from "@/lib/tradeSelector";
import { classifyTrade } from "@/lib/tradeClassification";
import { shouldUpdateSignal, SignalState } from "@/lib/signalThrottling";

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
      return NextResponse.json({ error: "Insufficient candle data" }, { status: 503 });
    }

    // Calculate indicators
    const indicators = await import("@/lib/indicators").then(m => m.calculateAllIndicators(candles_15m));
    if (!indicators) {
      return NextResponse.json({ error: "Indicator calculation failed" }, { status: 500 });
    }

    // Run all engines
    const alpha = calculateEnhancedAlpha(candles_15m, candles_1h, candles_4h, market, null);
    if (!alpha) {
      return NextResponse.json({ error: "Alpha calculation failed" }, { status: 500 });
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

    // Apply HARD NO TRADE RULE
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

    const hardRuleCheck = evAnalysis ? 
      applyHardNoTradeRule(evAnalysis, consensus, alpha) :
      { shouldTrade: false, reason: "No EV analysis", blockingRule: "NO_EV" };

    if (!hardRuleCheck.shouldTrade) {
      const noTradeResponse = {
        bestTrade: null,
        decision: "NO_TRADE",
        reason: hardRuleCheck.reason,
        blockingRule: hardRuleCheck.blockingRule,
        message: "No Edge — Do Not Trade",
        confidence: 95,
        tradeClass: {
          level: "NO_TRADE" as const,
          color: "#374151",
          backgroundColor: "#111827",
          borderColor: "#4b5563",
          priority: 4,
          description: "No Edge - Do Not Trade",
          shouldDisplay: false,
          opacity: 0.4
        },
        timestamp: Date.now(),
        marketContext: {
          price,
          volatility: (indicators.atr / price) * 100,
          regime: alpha.regime.regime,
          trend: consensus.direction
        }
      };

      return NextResponse.json(noTradeResponse, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Apply trade filter (evAnalysis is non-null here — hardRuleCheck returns false when null)
    const filterResult = filterTrade(evAnalysis!, alpha, consensus, indicators, market, sessionState);

    if (!filterResult.shouldTrade) {
      const noTradeResponse = {
        bestTrade: null,
        decision: "NO_TRADE",
        reason: filterResult.blockedBy[0] || "Trade filtered out",
        blockingRule: "FILTER",
        message: "No Edge — Do Not Trade",
        confidence: filterResult.confidence,
        tradeClass: {
          level: "NO_TRADE" as const,
          color: "#374151",
          backgroundColor: "#111827",
          borderColor: "#4b5563",
          priority: 4,
          description: "No Edge - Do Not Trade",
          shouldDisplay: false,
          opacity: 0.4
        },
        timestamp: Date.now(),
        marketContext: {
          price,
          volatility: (indicators.atr / price) * 100,
          regime: alpha.regime.regime,
          trend: consensus.direction
        }
      };

      return NextResponse.json(noTradeResponse, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Select best trade (EV-FIRST)
    const selectionResult = selectBestTrade(
      alpha,
      consensus,
      [], // kalshiSignals
      indicators,
      market,
      sessionState,
      { minEV: 0.02, preferKalshi: false, riskTolerance: "MODERATE" }
    );

    if (!selectionResult.bestTrade) {
      const noTradeResponse = {
        bestTrade: null,
        decision: "NO_TRADE",
        reason: "No viable trades found",
        blockingRule: "NO_VIABLE",
        message: "No Edge — Do Not Trade",
        confidence: 80,
        tradeClass: {
          level: "NO_TRADE" as const,
          color: "#374151",
          backgroundColor: "#111827",
          borderColor: "#4b5563",
          priority: 4,
          description: "No Edge - Do Not Trade",
          shouldDisplay: false,
          opacity: 0.4
        },
        timestamp: Date.now(),
        marketContext: {
          price,
          volatility: (indicators.atr / price) * 100,
          regime: alpha.regime.regime,
          trend: consensus.direction
        }
      };

      return NextResponse.json(noTradeResponse, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Classify the best trade
    const tradeClass = classifyTrade(
      selectionResult.bestTrade.ev,
      selectionResult.bestTrade.probability,
      selectionResult.bestTrade.confidence
    );

    // Generate reasons for the trade
    const reasons = generateTradeReasons(alpha, consensus, evAnalysis, selectionResult.bestTrade);

    // Apply confidence control (cap at 85%)
    const cappedProbability = Math.min(85, selectionResult.bestTrade.probability);
    const cappedConfidence = Math.min(85, selectionResult.bestTrade.confidence);

    // Create final best trade response
    const bestTradeResponse = {
      bestTrade: {
        ...selectionResult.bestTrade,
        probability: cappedProbability,
        confidence: cappedConfidence,
        originalProbability: selectionResult.bestTrade.probability,
        originalConfidence: selectionResult.bestTrade.confidence,
        probabilityCapped: selectionResult.bestTrade.probability > 85,
        confidenceCapped: selectionResult.bestTrade.confidence > 85
      },
      decision: "TRADE",
      reason: "Best trade identified",
      blockingRule: "NONE",
      message: `BEST TRADE: ${selectionResult.bestTrade.direction.toUpperCase()} (EV: ${selectionResult.bestTrade.ev.toFixed(3)})`,
      confidence: Math.round(filterResult.confidence),
      tradeClass,
      reasons,
      urgency: selectionResult.bestTrade.urgency,
      quality: selectionResult.bestTrade.quality,
      riskReward: selectionResult.bestTrade.riskReward,
      positionSize: selectionResult.bestTrade.positionSize,
      maxDrawdown: selectionResult.bestTrade.maxDrawdown,
      kellyFraction: selectionResult.bestTrade.kellyFraction,
      timeHorizon: selectionResult.bestTrade.timeHorizon,
      entryPrice: selectionResult.bestTrade.entryPrice,
      targetPrice: selectionResult.bestTrade.targetPrice,
      stopLoss: selectionResult.bestTrade.stopLoss,
      direction: selectionResult.bestTrade.direction,
      ev: Math.round(selectionResult.bestTrade.ev * 1000) / 1000,
      riskAdjustedEV: Math.round(selectionResult.bestTrade.riskAdjustedEV * 1000) / 1000,
      timestamp: Date.now(),
      marketContext: {
        price,
        volatility: (indicators.atr / price) * 100,
        regime: alpha.regime.regime,
        trend: consensus.direction,
        consensusStrength: consensus.strength,
        consensusAgreement: consensus.agreement,
        alphaScore: alpha.alphaScore,
        marketCondition: selectionResult.marketContext
      },
      // Additional context for UI
      summary: {
        totalCandidates: selectionResult.summary.totalCandidates,
        viableTrades: selectionResult.summary.viableTrades,
        averageEV: selectionResult.summary.averageEV,
        riskLevel: selectionResult.summary.riskLevel,
        recommendation: selectionResult.summary.recommendation
      }
    };

    return NextResponse.json(bestTradeResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Best Trade API error:", err);
    return NextResponse.json({ error: "Best trade analysis failed" }, { status: 500 });
  }
}

// Generate detailed reasons for the trade
function generateTradeReasons(alpha: any, consensus: any, evAnalysis: any, bestTrade: any): string[] {
  const reasons: string[] = [];

  // EV-based reasons
  if (evAnalysis && evAnalysis.ev.ev > 0.05) {
    reasons.push("High expected value detected");
  } else if (evAnalysis && evAnalysis.ev.ev > 0.02) {
    reasons.push("Positive expected value");
  }

  // Consensus reasons
  if (consensus.agreement > 80) {
    reasons.push("Strong agent consensus");
  } else if (consensus.agreement > 60) {
    reasons.push("Good agent agreement");
  }

  if (consensus.strength > 70) {
    reasons.push("Strong consensus signal");
  }

  // Alpha reasons
  if (alpha.alphaScore > 80) {
    reasons.push("Excellent alpha score");
  } else if (alpha.alphaScore > 70) {
    reasons.push("Good alpha score");
  }

  // Directional momentum
  if (consensus.direction === "ABOVE") {
    reasons.push("Momentum rising");
  } else if (consensus.direction === "BELOW") {
    reasons.push("Momentum falling");
  }

  // Risk/reward reasons
  if (bestTrade.riskReward > 2) {
    reasons.push("Excellent risk/reward ratio");
  } else if (bestTrade.riskReward > 1.5) {
    reasons.push("Good risk/reward ratio");
  }

  // Time horizon reasons
  if (bestTrade.timeHorizon < 30) {
    reasons.push("Short time horizon reduces risk");
  }

  // Regime reasons
  if (alpha.regime.regime === "TREND") {
    reasons.push("Favorable trend regime");
  } else if (alpha.regime.regime === "RANGE") {
    reasons.push("Stable range-bound regime");
  }

  // Volatility reasons
  const volatility = (bestTrade.maxDrawdown / bestTrade.entryPrice) * 100;
  if (volatility < 2) {
    reasons.push("Low volatility environment");
  }

  // Kalshi reasons (if applicable)
  if (bestTrade.type === "KALSHI") {
    reasons.push("Achievable Kalshi target");
  }

  // Confidence reasons
  if (bestTrade.confidence > 75) {
    reasons.push("High confidence level");
  }

  return reasons.slice(0, 5); // Limit to top 5 reasons
}
