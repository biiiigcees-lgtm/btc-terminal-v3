"use client";
// components/EMAPanel.tsx — Standalone EMA 9 / EMA 21 panel, separate from chart

import { useMemo } from "react";
import { calcEMA } from "@/lib/indicators";
import type { Candle } from "@/types";
import clsx from "clsx";

interface EMAPanelProps {
  candles: Candle[];
  price: number;
}

function detectCrossover(ema9: number[], ema21: number[]): { type: "GOLDEN" | "DEATH" | "NONE"; barsAgo: number } {
  // Walk backwards to find the most recent crossover
  for (let i = ema9.length - 2; i >= Math.max(0, ema9.length - 20); i--) {
    const prevAbove = ema9[i] > ema21[i];
    const currAbove = ema9[i + 1] > ema21[i + 1];
    if (!prevAbove && currAbove) {
      return { type: "GOLDEN", barsAgo: ema9.length - 2 - i };
    }
    if (prevAbove && !currAbove) {
      return { type: "DEATH", barsAgo: ema9.length - 2 - i };
    }
  }
  return { type: "NONE", barsAgo: -1 };
}

export function EMAPanel({ candles, price }: EMAPanelProps) {
  const { ema9, ema21, crossover, trend } = useMemo(() => {
    if (!candles || candles.length < 22) {
      return { ema9: 0, ema21: 0, crossover: { type: "NONE" as const, barsAgo: -1 }, trend: "NEUTRAL" as const };
    }

    const closes = candles.map((c) => c.close);
    const ema9Arr = calcEMA(closes, 9);
    const ema21Arr = calcEMA(closes, 21);

    const ema9Val = ema9Arr[ema9Arr.length - 1];
    const ema21Val = ema21Arr[ema21Arr.length - 1];
    const xo = detectCrossover(ema9Arr, ema21Arr);

    // Trend determination
    const priceAboveEma9 = price > ema9Val;
    const priceAboveEma21 = price > ema21Val;
    const ema9AboveEma21 = ema9Val > ema21Val;
    const trendLabel =
      priceAboveEma9 && priceAboveEma21 && ema9AboveEma21 ? "BULLISH" :
      !priceAboveEma9 && !priceAboveEma21 && !ema9AboveEma21 ? "BEARISH" : "NEUTRAL";

    return { ema9: ema9Val, ema21: ema21Val, crossover: xo, trend: trendLabel };
  }, [candles, price]);

  const ema9Pct = ema9 > 0 ? ((price - ema9) / ema9) * 100 : 0;
  const ema21Pct = ema21 > 0 ? ((price - ema21) / ema21) * 100 : 0;

  const priceAboveEma9 = price > ema9;
  const priceAboveEma21 = price > ema21;

  const crossoverLabel =
    crossover.type === "GOLDEN" ? "GOLDEN CROSS" :
    crossover.type === "DEATH" ? "DEATH CROSS" : "NO RECENT CROSS";

  const crossoverColor =
    crossover.type === "GOLDEN" ? "text-green" :
    crossover.type === "DEATH" ? "text-red" : "text-dim";

  const trendColor =
    trend === "BULLISH" ? "text-green" :
    trend === "BEARISH" ? "text-red" : "text-amber";

  const trendBg =
    trend === "BULLISH" ? "bg-green/10 border-green/20" :
    trend === "BEARISH" ? "bg-red/10 border-red/20" : "bg-amber/10 border-amber/20";

  return (
    <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-dim text-[10px] font-mono uppercase tracking-widest">EMA Panel</span>
        <span className={clsx("text-[9px] font-mono font-bold px-2 py-0.5 rounded border", trendBg, trendColor)}>
          {trend}
        </span>
      </div>

      {/* EMA 9 */}
      <div className="bg-panel rounded p-2.5 border border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-dim text-[10px] font-mono font-bold">EMA 9</span>
          <span className={clsx("text-[9px] font-mono", priceAboveEma9 ? "text-green" : "text-red")}>
            {priceAboveEma9 ? "▲ ABOVE" : "▼ BELOW"}
          </span>
        </div>
        <div className={clsx("text-lg font-mono font-bold num leading-none", priceAboveEma9 ? "text-green" : "text-red")}>
          ${ema9.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
        <div className={clsx("text-[10px] font-mono mt-0.5", ema9Pct >= 0 ? "text-green/70" : "text-red/70")}>
          {ema9Pct >= 0 ? "+" : ""}{ema9Pct.toFixed(2)}% from price
        </div>
      </div>

      {/* EMA 21 */}
      <div className="bg-panel rounded p-2.5 border border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-dim text-[10px] font-mono font-bold">EMA 21</span>
          <span className={clsx("text-[9px] font-mono", priceAboveEma21 ? "text-green" : "text-red")}>
            {priceAboveEma21 ? "▲ ABOVE" : "▼ BELOW"}
          </span>
        </div>
        <div className={clsx("text-lg font-mono font-bold num leading-none", priceAboveEma21 ? "text-green" : "text-red")}>
          ${ema21.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
        <div className={clsx("text-[10px] font-mono mt-0.5", ema21Pct >= 0 ? "text-green/70" : "text-red/70")}>
          {ema21Pct >= 0 ? "+" : ""}{ema21Pct.toFixed(2)}% from price
        </div>
      </div>

      {/* Crossover status */}
      <div className="bg-panel rounded p-2.5 border border-border">
        <div className="text-dim text-[9px] font-mono uppercase mb-1">Last Crossover</div>
        <div className={clsx("text-sm font-mono font-bold", crossoverColor)}>{crossoverLabel}</div>
        {crossover.barsAgo >= 0 && (
          <div className="text-dim text-[10px] font-mono mt-0.5">
            {crossover.barsAgo === 0 ? "just happened" : `${crossover.barsAgo} candle${crossover.barsAgo > 1 ? "s" : ""} ago`}
          </div>
        )}
      </div>

      {/* EMA spread */}
      <div className="bg-panel rounded p-2.5 border border-border">
        <div className="text-dim text-[9px] font-mono uppercase mb-1.5">EMA Spread (9 − 21)</div>
        {ema9 > 0 && ema21 > 0 ? (
          <>
            <div className={clsx("text-sm font-mono font-bold num", ema9 > ema21 ? "text-green" : "text-red")}>
              {ema9 > ema21 ? "+" : ""}${(ema9 - ema21).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="mt-1 h-1 bg-border rounded-full overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all duration-700", ema9 > ema21 ? "bg-green" : "bg-red")}
                style={{ width: `${Math.min(100, Math.abs((ema9 - ema21) / ema21) * 2000)}%` }}
              />
            </div>
          </>
        ) : (
          <div className="text-dim text-[10px] font-mono">Loading…</div>
        )}
      </div>
    </div>
  );
}
