// lib/scoring.ts — God-tier Alpha scoring engine for BTC Terminal v3
// Minimum threshold: 70+ to bet. Multi-indicator confluence required.

import type { Indicators, Candle } from "@/types";
import { atrVolatilityGate, getTimeWindow, calcHTFBias } from "./indicators";

export interface ScoreBreakdown {
  trend: number;       // EMA alignment
  momentum: number;    // RSI, Stoch, Williams R, CCI
  flow: number;        // MACD, CMF, CVD
  volatility: number;  // BB position, ATR context
  htf: number;         // Multi-timeframe bias
  total: number;
  direction: "ABOVE" | "BELOW" | "WAIT";
  signals: string[];
}

export function computeAlphaScore(
  ind: Indicators,
  candles_15m: Candle[],
  candles_1h: Candle[],
  candles_4h: Candle[],
  price: number,
): ScoreBreakdown {
  let bullScore = 0, bearScore = 0;
  const signals: string[] = [];

  // ── TREND BLOCK (30 pts max) ───────────────────────────────────────────────
  // EMA 9 vs 21
  if (ind.ema9 > ind.ema21) { bullScore += 10; signals.push("EMA9>21 ▲"); }
  else { bearScore += 10; signals.push("EMA9<21 ▽"); }

  // EMA 21 vs 50
  if (ind.ema21 > ind.ema50) { bullScore += 10; signals.push("EMA21>50 ▲"); }
  else { bearScore += 10; signals.push("EMA21<50 ▽"); }

  // Price vs VWAP
  if (price > ind.vwap) { bullScore += 10; signals.push("Above VWAP ▲"); }
  else { bearScore += 10; signals.push("Below VWAP ▽"); }

  // ── MOMENTUM BLOCK (30 pts max) ────────────────────────────────────────────
  // RSI
  if (ind.rsi > 55 && ind.rsi < 75) { bullScore += 8; signals.push(`RSI ${ind.rsi.toFixed(0)} ▲`); }
  else if (ind.rsi < 45 && ind.rsi > 25) { bearScore += 8; signals.push(`RSI ${ind.rsi.toFixed(0)} ▽`); }
  else if (ind.rsi >= 75) { bearScore += 4; signals.push("RSI Overbought ▽"); }
  else if (ind.rsi <= 25) { bullScore += 4; signals.push("RSI Oversold ▲"); }

  // Stochastics
  if (ind.stochK > 50 && ind.stochK > ind.stochD) { bullScore += 6; signals.push("Stoch Bull ▲"); }
  else if (ind.stochK < 50 && ind.stochK < ind.stochD) { bearScore += 6; signals.push("Stoch Bear ▽"); }

  // Williams %R (NEW) — overbought < -80, oversold > -20
  if (ind.williamsR > -20) { bearScore += 8; signals.push(`W%R ${ind.williamsR.toFixed(0)} Overbought ▽`); }
  else if (ind.williamsR < -80) { bullScore += 8; signals.push(`W%R ${ind.williamsR.toFixed(0)} Oversold ▲`); }
  else if (ind.williamsR > -40) { bearScore += 4; signals.push("W%R Bearish ▽"); }
  else if (ind.williamsR < -60) { bullScore += 4; signals.push("W%R Bullish ▲"); }

  // CCI (NEW) — above +100 overbought, below -100 oversold
  if (ind.cci > 100) { bearScore += 8; signals.push(`CCI ${ind.cci.toFixed(0)} Overbought ▽`); }
  else if (ind.cci < -100) { bullScore += 8; signals.push(`CCI ${ind.cci.toFixed(0)} Oversold ▲`); }
  else if (ind.cci > 0) { bullScore += 3; signals.push("CCI Positive ▲"); }
  else { bearScore += 3; signals.push("CCI Negative ▽"); }

  // ── FLOW BLOCK (25 pts max) ────────────────────────────────────────────────
  // MACD
  if (ind.macd > ind.macdSignal && ind.macdHist > 0) { bullScore += 10; signals.push("MACD Bull Cross ▲"); }
  else if (ind.macd < ind.macdSignal && ind.macdHist < 0) { bearScore += 10; signals.push("MACD Bear Cross ▽"); }

  // CMF (NEW) — positive = buying pressure, negative = selling
  if (ind.cmf > 0.1) { bullScore += 8; signals.push(`CMF ${ind.cmf.toFixed(2)} Bull ▲`); }
  else if (ind.cmf < -0.1) { bearScore += 8; signals.push(`CMF ${ind.cmf.toFixed(2)} Bear ▽`); }

  // Momentum
  if (ind.momentum > 0.3) { bullScore += 7; signals.push("Momentum ▲"); }
  else if (ind.momentum < -0.3) { bearScore += 7; signals.push("Momentum ▽"); }

  // ── VOLATILITY / BB BLOCK (15 pts max) ────────────────────────────────────
  const bbRange = ind.bbUpper - ind.bbLower;
  const bbPos = bbRange > 0 ? (price - ind.bbLower) / bbRange : 0.5;
  if (bbPos > 0.8) { bearScore += 8; signals.push("BB Upper ▽"); }
  else if (bbPos < 0.2) { bullScore += 8; signals.push("BB Lower ▲"); }
  else if (bbPos > 0.6) { bullScore += 4; signals.push("BB Mid-High ▲"); }
  else { bearScore += 4; signals.push("BB Mid-Low ▽"); }

  // BB squeeze (low volatility = breakout incoming)
  const bbWidth = bbRange / ind.bbMid;
  if (bbWidth < 0.02) { signals.push("BB Squeeze ⚡"); }

  // ── MULTI-TIMEFRAME BLOCK (20 pts max) ────────────────────────────────────
  const htfBias = calcHTFBias(candles_1h, candles_4h);
  let htfScore = 0;
  if (htfBias === "BULL") { bullScore += 20; htfScore = 20; signals.push("HTF Bias BULL ▲▲"); }
  else if (htfBias === "BEAR") { bearScore += 20; htfScore = 20; signals.push("HTF Bias BEAR ▽▽"); }
  else { signals.push("HTF Neutral —"); }

  // ── FINAL ALPHA CALCULATION ────────────────────────────────────────────────
  const maxPossible = 120;
  const net = bullScore - bearScore;
  // Normalize to 0-100
  const rawAlpha = Math.round(((net + maxPossible) / (maxPossible * 2)) * 100);
  const alpha = Math.max(0, Math.min(100, rawAlpha));

  // Direction requires alpha >= 65 to show ABOVE/BELOW
  // And BET tier requires >= 70
  let direction: "ABOVE" | "BELOW" | "WAIT" = "WAIT";
  if (alpha >= 65 && bullScore > bearScore) direction = "ABOVE";
  else if (alpha <= 35 && bearScore > bullScore) direction = "BELOW";

  return {
    trend: Math.round((bullScore > bearScore ? bullScore : bearScore) * 0.3),
    momentum: Math.round((bullScore > bearScore ? bullScore : bearScore) * 0.3),
    flow: Math.round((bullScore > bearScore ? bullScore : bearScore) * 0.25),
    volatility: Math.round((bullScore > bearScore ? bullScore : bearScore) * 0.15),
    htf: htfScore,
    total: alpha,
    direction,
    signals,
  };
}

export function getConfidenceTier(alpha: number, atrGate: boolean, timeGood: boolean, htfAligned: boolean): {
  tier: "DO_NOT_BET" | "MARGINAL" | "BET" | "HIGH_CONVICTION";
  label: string;
  color: string;
  shouldBet: boolean;
} {
  // Gate checks first
  if (!atrGate) return { tier: "DO_NOT_BET", label: "🔴 VOLATILITY GATE — DO NOT BET", color: "red", shouldBet: false };
  if (!timeGood) return { tier: "DO_NOT_BET", label: "🔴 BAD TIME WINDOW — DO NOT BET", color: "red", shouldBet: false };
  if (!htfAligned) return { tier: "MARGINAL", label: "🟡 HTF CONFLICT — MARGINAL", color: "amber", shouldBet: false };
  if (alpha >= 80) return { tier: "HIGH_CONVICTION", label: "💎 HIGH CONVICTION — BET", color: "green", shouldBet: true };
  if (alpha >= 70) return { tier: "BET", label: "🟢 CONFIRMED SIGNAL — BET", color: "green", shouldBet: true };
  if (alpha >= 60) return { tier: "MARGINAL", label: "🟡 MARGINAL — SMALL BET ONLY", color: "amber", shouldBet: false };
  return { tier: "DO_NOT_BET", label: "🔴 DO NOT BET — WAIT", color: "red", shouldBet: false };
}

// ── Kelly Position Sizer ──────────────────────────────────────────────────────
export function calcKellyBet(bankroll: number, confidence: number, winMultiple = 1.0): {
  prob: number;
  kelly: number;
  halfKelly: number;
  betSize: number;
  maxWin: number;
} {
  const prob = Math.min(0.95, Math.max(0.5, confidence / 100));
  const q = 1 - prob;
  const b = winMultiple;
  const kelly = Math.max(0, (b * prob - q) / b);
  const halfKelly = kelly / 2;
  const betSize = Math.round(bankroll * halfKelly * 100) / 100;
  return { prob, kelly, halfKelly, betSize, maxWin: betSize * winMultiple };
}

// ── Session Loss Lock ──────────────────────────────────────────────────────────
export function checkLossLock(consecutiveLosses: number, lockUntil: number | null): {
  isLocked: boolean;
  minutesLeft: number;
  reason: string;
} {
  const now = Date.now();
  if (lockUntil && now < lockUntil) {
    return { isLocked: true, minutesLeft: Math.ceil((lockUntil - now) / 60000), reason: "3 consecutive losses — cooling off" };
  }
  if (consecutiveLosses >= 3) {
    return { isLocked: true, minutesLeft: 30, reason: "3 consecutive losses — 30 min cooldown" };
  }
  return { isLocked: false, minutesLeft: 0, reason: "" };
}
