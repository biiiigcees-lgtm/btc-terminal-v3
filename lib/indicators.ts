// lib/indicators.ts — Full technical indicator suite for BTC Terminal v3

import type { Candle, Indicators } from "@/types";

// ─── EMA ─────────────────────────────────────────────────────────────────────
export function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = closes[0];
  for (let i = 0; i < closes.length; i++) {
    ema = i === 0 ? closes[0] : closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

// ─── RSI ─────────────────────────────────────────────────────────────────────
export function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(period).fill(50);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ─── MACD ────────────────────────────────────────────────────────────────────
export function calcMACD(closes: number[]): { macd: number[]; signal: number[]; hist: number[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macd, 9);
  const hist = macd.map((v, i) => v - signal[i]);
  return { macd, signal, hist };
}

// ─── Bollinger Bands ─────────────────────────────────────────────────────────
export function calcBB(closes: number[], period = 20, mult = 2): { upper: number[]; mid: number[]; lower: number[] } {
  const upper: number[] = [], mid: number[] = [], lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(closes[i]); mid.push(closes[i]); lower.push(closes[i]); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    mid.push(mean); upper.push(mean + mult * std); lower.push(mean - mult * std);
  }
  return { upper, mid, lower };
}

// ─── Stochastics ─────────────────────────────────────────────────────────────
export function calcStoch(candles: Candle[], kPeriod = 14, dPeriod = 3): { k: number[]; d: number[] } {
  const k: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) { k.push(50); continue; }
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map(c => c.high));
    const lowest = Math.min(...slice.map(c => c.low));
    k.push(highest === lowest ? 50 : ((candles[i].close - lowest) / (highest - lowest)) * 100);
  }
  const d = calcEMA(k, dPeriod);
  return { k, d };
}

// ─── VWAP ────────────────────────────────────────────────────────────────────
export function calcVWAP(candles: Candle[]): number[] {
  let cumPV = 0, cumVol = 0;
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume; cumVol += c.volume;
    return cumVol === 0 ? c.close : cumPV / cumVol;
  });
}

// ─── ATR ─────────────────────────────────────────────────────────────────────
export function calcATR(candles: Candle[], period = 14): number[] {
  const tr: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return calcEMA(tr, period);
}

// ─── Williams %R ─────────────────────────────────────────────────────────────
export function calcWilliamsR(candles: Candle[], period = 14): number[] {
  return candles.map((_, i) => {
    if (i < period - 1) return -50;
    const slice = candles.slice(i - period + 1, i + 1);
    const highest = Math.max(...slice.map(c => c.high));
    const lowest = Math.min(...slice.map(c => c.low));
    return highest === lowest ? -50 : ((highest - candles[i].close) / (highest - lowest)) * -100;
  });
}

// ─── CCI ─────────────────────────────────────────────────────────────────────
export function calcCCI(candles: Candle[], period = 20): number[] {
  return candles.map((_, i) => {
    if (i < period - 1) return 0;
    const slice = candles.slice(i - period + 1, i + 1);
    const tps = slice.map(c => (c.high + c.low + c.close) / 3);
    const meanTP = tps.reduce((a, b) => a + b, 0) / period;
    const meanDev = tps.reduce((a, b) => a + Math.abs(b - meanTP), 0) / period;
    return meanDev === 0 ? 0 : (tps[tps.length - 1] - meanTP) / (0.015 * meanDev);
  });
}

// ─── CMF (Chaikin Money Flow) ─────────────────────────────────────────────────
export function calcCMF(candles: Candle[], period = 20): number[] {
  const mfv = candles.map(c => {
    const range = c.high - c.low;
    if (range === 0) return 0;
    return ((c.close - c.low - (c.high - c.close)) / range) * c.volume;
  });
  return candles.map((_, i) => {
    if (i < period - 1) return 0;
    const mfvSum = mfv.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    const volSum = candles.slice(i - period + 1, i + 1).reduce((a, c) => a + c.volume, 0);
    return volSum === 0 ? 0 : mfvSum / volSum;
  });
}

// ─── Momentum ────────────────────────────────────────────────────────────────
export function calcMomentum(closes: number[], period = 10): number[] {
  return closes.map((c, i) => i < period ? 0 : ((c / closes[i - period]) - 1) * 100);
}

// ─── CVD (Cumulative Volume Delta approximation) ──────────────────────────────
export function calcCVD(candles: Candle[]): number[] {
  let cvd = 0;
  return candles.map(c => {
    const bullVol = c.close >= c.open ? c.volume : 0;
    const bearVol = c.close < c.open ? c.volume : 0;
    cvd += bullVol - bearVol;
    return cvd;
  });
}

// ─── Order Flow Imbalance ─────────────────────────────────────────────────────
export function calcOrderFlowImbalance(candles: Candle[]): number {
  const last5 = candles.slice(-5);
  const bull = last5.filter(c => c.close >= c.open).reduce((a, c) => a + c.volume, 0);
  const bear = last5.filter(c => c.close < c.open).reduce((a, c) => a + c.volume, 0);
  const total = bull + bear;
  return total === 0 ? 0 : (bull - bear) / total;
}

// ─── Master Indicator Calculator ─────────────────────────────────────────────
export function calculateAllIndicators(candles: Candle[]): Indicators | null {
  if (candles.length < 60) return null;
  const closes = candles.map(c => c.close);
  const ema9arr = calcEMA(closes, 9);
  const ema21arr = calcEMA(closes, 21);
  const ema50arr = calcEMA(closes, 50);
  const rsiArr = calcRSI(closes);
  const { macd, signal, hist } = calcMACD(closes);
  const bb = calcBB(closes);
  const stoch = calcStoch(candles);
  const vwapArr = calcVWAP(candles);
  const atrArr = calcATR(candles);
  const momArr = calcMomentum(closes);
  const wrArr = calcWilliamsR(candles);
  const cciArr = calcCCI(candles);
  const cmfArr = calcCMF(candles);
  const n = candles.length - 1;
  return {
    ema9: ema9arr[n], ema21: ema21arr[n], ema50: ema50arr[n],
    rsi: rsiArr[n], macd: macd[n], macdSignal: signal[n], macdHist: hist[n],
    bbUpper: bb.upper[n], bbMid: bb.mid[n], bbLower: bb.lower[n],
    stochK: stoch.k[n], stochD: stoch.d[n],
    vwap: vwapArr[n], atr: atrArr[n], momentum: momArr[n],
    williamsR: wrArr[n], cci: cciArr[n], cmf: cmfArr[n],
    ema9_1h: 0, ema21_1h: 0, rsi_1h: 0,
    ema9_4h: 0, ema21_4h: 0, rsi_4h: 0,
  };
}

// ─── ATR Volatility Gate ──────────────────────────────────────────────────────
// Returns true (safe) if current ATR is below 1.5x its 20-period average
export function atrVolatilityGate(candles: Candle[]): boolean {
  if (candles.length < 30) return false;
  const atrArr = calcATR(candles);
  const currentATR = atrArr[atrArr.length - 1];
  const avgATR = atrArr.slice(-20).reduce((a, b) => a + b, 0) / 20;
  return currentATR < avgATR * 1.5;
}

// ─── Time-of-Day Window ───────────────────────────────────────────────────────
// Based on empirical BTC volatility patterns — best windows for 15-min direction
export function getTimeWindow(hour: number): { good: boolean; label: string } {
  // UTC hours — peak liquidity / trending windows
  if (hour >= 13 && hour <= 16) return { good: true, label: "NY Open (Best)" };
  if (hour >= 8 && hour <= 10) return { good: true, label: "London Open (Good)" };
  if (hour >= 20 && hour <= 22) return { good: true, label: "US Evening (Good)" };
  if (hour >= 0 && hour <= 2) return { good: false, label: "Asia Dead Zone (Skip)" };
  if (hour >= 3 && hour <= 5) return { good: false, label: "Low Volume (Skip)" };
  return { good: true, label: "Standard Hours (OK)" };
}

// ─── HTF Bias ────────────────────────────────────────────────────────────────
export function calcHTFBias(candles_1h: Candle[], candles_4h: Candle[]): "BULL" | "BEAR" | "NEUTRAL" {
  if (candles_1h.length < 21 || candles_4h.length < 21) return "NEUTRAL";
  const closes_1h = candles_1h.map(c => c.close);
  const closes_4h = candles_4h.map(c => c.close);
  const ema9_1h = calcEMA(closes_1h, 9);
  const ema21_1h = calcEMA(closes_1h, 21);
  const ema9_4h = calcEMA(closes_4h, 9);
  const ema21_4h = calcEMA(closes_4h, 21);
  const n1h = closes_1h.length - 1;
  const n4h = closes_4h.length - 1;
  const bull1h = ema9_1h[n1h] > ema21_1h[n1h];
  const bull4h = ema9_4h[n4h] > ema21_4h[n4h];
  if (bull1h && bull4h) return "BULL";
  if (!bull1h && !bull4h) return "BEAR";
  return "NEUTRAL";
}
