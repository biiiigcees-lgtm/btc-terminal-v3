// app/api/kalshi/route.ts — Enhanced Kalshi market data with probability engine

import { NextResponse } from "next/server";
import { calculateKalshiProbability, generateKalshiSignal, getBestKalshiTrade, KalshiRound } from "@/lib/kalshiEngine";
import { calculateAllIndicators } from "@/lib/indicators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Mock Kalshi data - replace with real API integration
    const mockRounds: KalshiRound[] = [
      {
        ticker: "BTC-15min-50000-ABOVE",
        title: "Bitcoin > $50,000 in 15 minutes",
        yesPrice: 0.45,
        noPrice: 0.55,
        impliedProb: 45,
        volume: 125000,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        targetPrice: 50000,
        direction: "ABOVE",
        timeRemaining: 15,
        status: "ACTIVE"
      },
      {
        ticker: "BTC-15min-49500-ABOVE",
        title: "Bitcoin > $49,500 in 15 minutes",
        yesPrice: 0.62,
        noPrice: 0.38,
        impliedProb: 62,
        volume: 89000,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        targetPrice: 49500,
        direction: "ABOVE",
        timeRemaining: 15,
        status: "ACTIVE"
      },
      {
        ticker: "BTC-15min-50500-ABOVE",
        title: "Bitcoin > $50,500 in 15 minutes",
        yesPrice: 0.28,
        noPrice: 0.72,
        impliedProb: 28,
        volume: 156000,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        targetPrice: 50500,
        direction: "ABOVE",
        timeRemaining: 15,
        status: "ACTIVE"
      },
      {
        ticker: "BTC-15min-50000-BELOW",
        title: "Bitcoin < $50,000 in 15 minutes",
        yesPrice: 0.58,
        noPrice: 0.42,
        impliedProb: 58,
        volume: 98000,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        targetPrice: 50000,
        direction: "BELOW",
        timeRemaining: 15,
        status: "ACTIVE"
      }
    ];

    // Get current BTC price and indicators
    const marketRes = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/market`, { cache: "no-store" });
    if (!marketRes.ok) throw new Error("Failed to fetch market data");
    const market = await marketRes.json();
    
    const { candles_15m, price: currentPrice } = market;
    
    if (!candles_15m || candles_15m.length < 60) {
      return NextResponse.json({ error: "Insufficient candle data for Kalshi analysis" }, { status: 503 });
    }

    // Calculate indicators for probability analysis
    const indicators = calculateAllIndicators(candles_15m);
    if (!indicators) {
      return NextResponse.json({ error: "Failed to calculate indicators for Kalshi analysis" }, { status: 500 });
    }

    // Analyze each round with enhanced probability engine
    const analyzedRounds = mockRounds.map(round => {
      const probability = calculateKalshiProbability(
        round,
        currentPrice,
        indicators,
        candles_15m
      );
      
      const signal = generateKalshiSignal(
        round,
        currentPrice,
        indicators,
        candles_15m,
        25 // bankroll
      );
      
      return {
        ...round,
        currentPrice,
        probability,
        signal,
        analysis: {
          distance: probability.distanceToTarget,
          distancePercent: (probability.distanceToTarget / currentPrice) * 100,
          requiredMovePerMin: probability.requiredMovePerMin,
          timeDecayFactor: probability.timeDecayFactor,
          urgencyMode: probability.urgencyMode,
          adjustedProbability: probability.adjustedProbability
        }
      };
    });

    // Get best Kalshi trade
    const bestTrade = getBestKalshiTrade(
      mockRounds,
      currentPrice,
      indicators,
      candles_15m,
      25
    );

    // KALSHI REALITY ENGINE - Add feasibility and urgency analysis
    const realityEnhancedRounds = analyzedRounds.map(round => {
      // Use analysis data that's already calculated
      const distanceToTarget = round.analysis.distance;
      const requiredMovePerMin = round.analysis.requiredMovePerMin;
      
      // Calculate feasibility score (0-100)
      let feasibilityScore = 100;
      if (requiredMovePerMin > 50) feasibilityScore -= 30;
      else if (requiredMovePerMin > 25) feasibilityScore -= 20;
      else if (requiredMovePerMin > 10) feasibilityScore -= 10;
      
      if (round.probability.urgencyMode) feasibilityScore -= 25;
      else if (round.analysis.timeDecayFactor < 0.7) feasibilityScore -= 15;
      else if (round.analysis.timeDecayFactor < 0.9) feasibilityScore -= 5;
      
      if (round.analysis.distancePercent > 0.02) feasibilityScore -= 20; // >2% move
      else if (round.analysis.distancePercent > 0.01) feasibilityScore -= 10; // >1% move
      
      feasibilityScore = Math.max(0, Math.min(100, feasibilityScore));
      
      // Determine urgency level
      let urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME" = "LOW";
      if (round.probability.urgencyMode || requiredMovePerMin > 50) urgencyLevel = "EXTREME";
      else if (round.analysis.timeDecayFactor < 0.7 || requiredMovePerMin > 25) urgencyLevel = "HIGH";
      else if (round.analysis.timeDecayFactor < 0.9 || requiredMovePerMin > 10) urgencyLevel = "MEDIUM";
      
      // Check if target is unrealistic
      const isTargetUnrealistic = requiredMovePerMin > 100 || round.analysis.distancePercent > 0.02;
      
      // Cap probability if unrealistic
      let adjustedProbability = round.probability.yesProbability;
      let warning: string | null = null;
      
      if (isTargetUnrealistic) {
        warning = "Target unlikely given time remaining";
        adjustedProbability = Math.min(adjustedProbability, 30); // Cap at 30%
      }
      
      return {
        ...round,
        kalshiReality: {
          distanceToTarget,
          requiredMovePerMin,
          feasibilityScore,
          urgencyLevel,
          isTargetUnrealistic,
          warning,
          adjustedProbability,
          originalProbability: round.probability.yesProbability
        }
      };
    });

    // Calculate market efficiency metrics
    const marketEfficiency = {
      avgEdge: analyzedRounds.reduce((sum, r) => sum + Math.abs(r.probability.edge), 0) / analyzedRounds.length,
      avgConfidence: analyzedRounds.reduce((sum, r) => sum + r.probability.confidence, 0) / analyzedRounds.length,
      tradableRounds: analyzedRounds.filter(r => r.signal.recommendation !== "NO_BET").length,
      highProbabilityTrades: analyzedRounds.filter(r => r.probability.yesProbability > 65).length,
      urgentRounds: analyzedRounds.filter(r => r.probability.urgencyMode).length,
    };

    const kalshiResult = {
      rounds: realityEnhancedRounds,
      bestTrade,
      marketEfficiency: {
        avgEdge: analyzedRounds.length > 0 ? analyzedRounds.reduce((sum, r) => sum + Math.abs(r.probability.edge), 0) / analyzedRounds.length : 0,
        avgConfidence: analyzedRounds.length > 0 ? analyzedRounds.reduce((sum, r) => sum + r.probability.confidence, 0) / analyzedRounds.length : 0,
        totalRounds: analyzedRounds.length,
        tradableRounds: analyzedRounds.filter(r => r.signal.recommendation !== "NO_BET").length,
        avgFeasibility: realityEnhancedRounds.length > 0 ? 
          realityEnhancedRounds.reduce((sum, r) => sum + r.kalshiReality.feasibilityScore, 0) / realityEnhancedRounds.length : 0
      },
      summary: {
        totalRounds: analyzedRounds.length,
        avgProbability: analyzedRounds.length > 0 ? analyzedRounds.reduce((sum, r) => sum + r.probability.yesProbability, 0) / analyzedRounds.length : 0,
        highestEdge: analyzedRounds.length > 0 ? Math.max(...analyzedRounds.map(r => Math.abs(r.probability.edge))) : 0,
        mostLiquid: analyzedRounds.length > 0 ? analyzedRounds.reduce((max, r) => r.volume > max.volume ? r : max, analyzedRounds[0]) : null,
        unrealisticTargets: realityEnhancedRounds.filter(r => r.kalshiReality.isTargetUnrealistic).length,
        urgentRounds: realityEnhancedRounds.filter(r => r.kalshiReality.urgencyLevel === "HIGH" || r.kalshiReality.urgencyLevel === "EXTREME").length
      },
      indicators: {
        rsi: indicators.rsi,
        momentum: indicators.momentum,
        atr: indicators.atr,
        volatilityPercent: (indicators.atr / currentPrice) * 100,
        price: currentPrice,
        trend: indicators.ema9 > indicators.ema21 ? "BULLISH" : "BEARISH",
        volatility: (indicators.atr / currentPrice) * 100
      },
      reality: {
        avgRequiredMovePerMin: realityEnhancedRounds.length > 0 ?
          realityEnhancedRounds.reduce((sum, r) => sum + r.kalshiReality.requiredMovePerMin, 0) / realityEnhancedRounds.length : 0,
        avgDistanceToTarget: realityEnhancedRounds.length > 0 ?
          realityEnhancedRounds.reduce((sum, r) => sum + r.kalshiReality.distanceToTarget, 0) / realityEnhancedRounds.length : 0,
        warnings: realityEnhancedRounds.filter(r => r.kalshiReality.warning).map(r => r.kalshiReality.warning)
      },
      timestamp: Date.now()
    };

    return NextResponse.json(kalshiResult, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Kalshi API error:", err);
    return NextResponse.json({ error: "Kalshi data fetch failed" }, { status: 500 });
  }
}
