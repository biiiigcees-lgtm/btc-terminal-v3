// lib/backtest.ts — Historical backtesting engine for BTC Terminal v3
// Runs the full Alpha scoring against past candles to measure real edge

import type { Candle, BacktestResult, BacktestTrade } from "@/types";
import { calculateAllIndicators, atrVolatilityGate, getTimeWindow, calcHTFBias } from "./indicators";
import { computeAlphaScore, getConfidenceTier } from "./scoring";

const MIN_ALPHA = 70;
const BET_SIZE = 1; // normalized $1 per trade for clean stats

export function runBacktest(
  candles_15m: Candle[],
  candles_1h: Candle[],
  candles_4h: Candle[],
  minAlpha = MIN_ALPHA
): BacktestResult {
  const trades: BacktestTrade[] = [];
  let pnl = 0;
  let peak = 0;
  let maxDrawdown = 0;

  // Need at least 100 candles — walk forward with 60 candle lookback
  const start = 80;
  const end = candles_15m.length - 2; // need next candle for result

  for (let i = start; i < end; i++) {
    const slice_15m = candles_15m.slice(0, i + 1);
    const price = slice_15m[slice_15m.length - 1].close;
    const nextCandle = candles_15m[i + 1];

    const ind = calculateAllIndicators(slice_15m);
    if (!ind) continue;

    // Align 1h/4h candles to current time
    const currentTime = slice_15m[slice_15m.length - 1].time;
    const slice_1h = candles_1h.filter(c => c.time <= currentTime);
    const slice_4h = candles_4h.filter(c => c.time <= currentTime);

    const atrGate = atrVolatilityGate(slice_15m);
    const hour = new Date(currentTime * 1000).getUTCHours();
    const timeWindow = getTimeWindow(hour);
    const htfBias = calcHTFBias(slice_1h, slice_4h);
    const htfAligned = htfBias !== "NEUTRAL";

    const score = computeAlphaScore(ind, slice_15m, slice_1h, slice_4h, price);
    const tier = getConfidenceTier(score.total, atrGate, timeWindow.good, htfAligned);

    // Only trade when all gates pass and alpha meets threshold
    if (!tier.shouldBet || score.total < minAlpha || score.direction === "WAIT") continue;

    const exitPrice = nextCandle.close;
    const won = score.direction === "ABOVE"
      ? exitPrice > price
      : exitPrice < price;

    const tradePnl = won ? BET_SIZE : -BET_SIZE;
    pnl += tradePnl;

    if (pnl > peak) peak = pnl;
    const drawdown = peak - pnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    trades.push({
      time: currentTime,
      direction: score.direction as "ABOVE" | "BELOW",
      alpha: score.total,
      entryPrice: price,
      exitPrice,
      result: won ? "WIN" : "LOSS",
      pnl: tradePnl,
    });
  }

  // Aggregate stats
  const wins = trades.filter(t => t.result === "WIN").length;
  const losses = trades.filter(t => t.result === "LOSS").length;
  const total = trades.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // By alpha bracket
  const brackets = ["60-64", "65-69", "70-74", "75-79", "80-84", "85-89", "90+"];
  const byAlphaBracket: BacktestResult["byAlphaBracket"] = {};
  for (const b of brackets) {
    const [lo, hi] = b === "90+" ? [90, 101] : b.split("-").map(Number);
    const bt = trades.filter(t => t.alpha >= lo && t.alpha < hi);
    const bw = bt.filter(t => t.result === "WIN").length;
    byAlphaBracket[b] = {
      trades: bt.length,
      wins: bw,
      losses: bt.length - bw,
      winRate: bt.length > 0 ? Math.round((bw / bt.length) * 100) : 0,
    };
  }

  // By hour
  const byHour: BacktestResult["byHour"] = {};
  for (let h = 0; h < 24; h++) {
    const ht = trades.filter(t => new Date(t.time * 1000).getUTCHours() === h);
    const hw = ht.filter(t => t.result === "WIN").length;
    byHour[h] = {
      wins: hw,
      losses: ht.length - hw,
      winRate: ht.length > 0 ? Math.round((hw / ht.length) * 100) : 0,
    };
  }

  // Best/worst hour (min 3 trades)
  const hoursWithData = Object.entries(byHour).filter(([, v]) => v.wins + v.losses >= 3);
  const bestHour = hoursWithData.length > 0
    ? parseInt(hoursWithData.sort((a, b) => b[1].winRate - a[1].winRate)[0][0])
    : 13;
  const worstHour = hoursWithData.length > 0
    ? parseInt(hoursWithData.sort((a, b) => a[1].winRate - b[1].winRate)[0][0])
    : 3;

  // Best alpha bracket
  const bracketsWithData = Object.entries(byAlphaBracket).filter(([, v]) => v.trades >= 3);
  const bestAlphaBracket = bracketsWithData.length > 0
    ? bracketsWithData.sort((a, b) => b[1].winRate - a[1].winRate)[0][0]
    : "70-74";

  // Sharpe ratio (simplified: mean return / std dev of returns)
  const returns = trades.map(t => t.pnl);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / returns.length)
    : 1;
  const sharpeRatio = stdDev > 0 ? parseFloat((meanReturn / stdDev).toFixed(2)) : 0;

  return {
    totalTrades: total,
    wins,
    losses,
    winRate,
    netPnl: parseFloat(pnl.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    peakPnl: parseFloat(peak.toFixed(2)),
    byAlphaBracket,
    byHour,
    trades: trades.slice(-100), // last 100 for display
    bestHour,
    worstHour,
    bestAlphaBracket,
    sharpeRatio,
  };
}
