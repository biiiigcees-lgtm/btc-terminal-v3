"use client";
// components/DashboardTab.tsx — Live BTC dashboard: chart + EMA panel + AI suggestions

import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTerminal } from "@/store/terminal";
import { EMAPanel } from "@/components/EMAPanel";
import { AIBettingPanel } from "@/components/AIBettingPanel";
import { calcEMA } from "@/lib/indicators";
import clsx from "clsx";

// Load chart client-side only (uses DOM APIs)
const LiveChart = dynamic(() => import("@/components/LiveChart").then((m) => ({ default: m.LiveChart })), {
  ssr: false,
  loading: () => (
    <div className="bg-surface border border-border rounded-lg flex items-center justify-center" style={{ height: 490 }}>
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <span className="text-dim text-[10px] font-mono">Loading chart…</span>
      </div>
    </div>
  ),
});

export function DashboardTab() {
  const { market, signal } = useTerminal();

  // Fast price-only state (5s local poll)
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  // EMA values derived from candles (needed to pass to AI panel)
  const { ema9Val, ema21Val, crossoverStatus, candlesSinceCross } = useMemo(() => {
    const candles = market?.candles_15m;
    if (!candles || candles.length < 22) {
      return { ema9Val: 0, ema21Val: 0, crossoverStatus: "NO RECENT CROSS", candlesSinceCross: -1 };
    }
    const closes = candles.map((c) => c.close);
    const ema9Arr = calcEMA(closes, 9);
    const ema21Arr = calcEMA(closes, 21);
    const e9 = ema9Arr[ema9Arr.length - 1];
    const e21 = ema21Arr[ema21Arr.length - 1];

    let status = "NEUTRAL";
    let barsAgo = -1;
    for (let i = ema9Arr.length - 2; i >= Math.max(0, ema9Arr.length - 20); i--) {
      const prevAbove = ema9Arr[i] > ema21Arr[i];
      const currAbove = ema9Arr[i + 1] > ema21Arr[i + 1];
      if (!prevAbove && currAbove) { status = "GOLDEN CROSS"; barsAgo = ema9Arr.length - 2 - i; break; }
      if (prevAbove && !currAbove) { status = "DEATH CROSS"; barsAgo = ema9Arr.length - 2 - i; break; }
    }
    return { ema9Val: e9, ema21Val: e21, crossoverStatus: status, candlesSinceCross: barsAgo };
  }, [market?.candles_15m]);

  // 5s fast price poll from Binance
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(
          "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          const newPrice = parseFloat(data.price);
          if (!isNaN(newPrice)) {
            const prev = prevPriceRef.current;
            if (prev !== null && newPrice !== prev) {
              setPriceFlash(newPrice > prev ? "up" : "down");
              setTimeout(() => setPriceFlash(null), 600);
            }
            prevPriceRef.current = newPrice;
            setLivePrice(newPrice);
            setLastUpdate(Date.now());
          }
        }
      } catch {
        // Use market price as fallback
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const displayPrice = livePrice ?? market?.price ?? 0;
  const change24h = market?.change24h ?? 0;
  const volume24h = market?.volume24h ?? 0;
  const candles = market?.candles_15m ?? [];

  const secsAgo = lastUpdate > 0 ? Math.round((Date.now() - lastUpdate) / 1000) : null;

  return (
    <div className="flex flex-col gap-3 h-full animate-fade-in">
      {/* ── Live price header ──────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-lg px-4 py-3 flex flex-wrap items-center gap-4">
        {/* BTC price */}
        <div className="flex items-baseline gap-2">
          <span className="text-accent text-xl font-mono font-bold">₿</span>
          <span
            className={clsx(
              "text-3xl font-mono font-bold num tabular-nums transition-colors duration-300",
              priceFlash === "up" ? "text-green" :
              priceFlash === "down" ? "text-red" : "text-text"
            )}
          >
            ${displayPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* 24h change */}
        <div className={clsx("flex items-center gap-1 text-sm font-mono font-bold", change24h >= 0 ? "text-green" : "text-red")}>
          {change24h >= 0 ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}%
          <span className="text-dim font-normal text-[10px] ml-1">24h</span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-dim">
          <span className="text-muted">Vol</span>
          <span className="text-text font-bold">
            ${volume24h >= 1e9
              ? `${(volume24h / 1e9).toFixed(1)}B`
              : volume24h >= 1e6
              ? `${(volume24h / 1e6).toFixed(0)}M`
              : volume24h.toFixed(0)}
          </span>
        </div>

        {/* Multi-exchange spread */}
        {market && (
          <div className="hidden sm:flex items-center gap-3 text-[9px] font-mono text-dim ml-auto">
            <span>BNB <span className="text-text">${market.binance?.toLocaleString()}</span></span>
            <span>CB <span className="text-text">${market.coinbase?.toLocaleString()}</span></span>
            <span>KRK <span className="text-text">${market.kraken?.toLocaleString()}</span></span>
          </div>
        )}

        {/* Live dot + update time */}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span className="text-[9px] font-mono text-dim">
            LIVE{secsAgo !== null ? ` · ${secsAgo}s` : ""}
          </span>
        </div>

        {/* Signal tier badge */}
        {signal?.confidenceTier && (
          <div className={clsx(
            "text-[9px] font-mono font-bold px-2 py-0.5 rounded border",
            signal.confidenceTier === "HIGH_CONVICTION" ? "text-green bg-green/10 border-green/20" :
            signal.confidenceTier === "BET" ? "text-green bg-green/10 border-green/20" :
            signal.confidenceTier === "MARGINAL" ? "text-amber bg-amber/10 border-amber/20" :
            "text-red bg-red/10 border-red/20"
          )}>
            {signal.confidenceTier.replace("_", " ")}
          </div>
        )}
      </div>

      {/* ── Main content: chart (left) + panels (right) ────────────────────────── */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Chart column */}
        <div className="flex-1 min-w-0">
          {candles.length > 0 ? (
            <LiveChart candles={candles} />
          ) : (
            <div className="bg-surface border border-border rounded-lg flex items-center justify-center" style={{ height: 490 }}>
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span className="text-dim text-[10px] font-mono">Fetching candle data…</span>
              </div>
            </div>
          )}
        </div>

        {/* Right panel column */}
        <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <EMAPanel candles={candles} price={displayPrice} />
          <AIBettingPanel
            price={displayPrice}
            signal={signal}
            ema9={ema9Val}
            ema21={ema21Val}
            crossoverStatus={crossoverStatus}
            candlesSinceCross={candlesSinceCross}
          />
        </div>
      </div>

      {/* ── Indicator strip ────────────────────────────────────────────────────── */}
      {signal?.indicators && (
        <div className="bg-surface border border-border rounded-lg px-4 py-2 flex flex-wrap items-center gap-4">
          <IndicatorChip label="RSI" value={signal.indicators.rsi?.toFixed(1)} warn={signal.indicators.rsi !== undefined && (signal.indicators.rsi > 70 || signal.indicators.rsi < 30)} />
          <IndicatorChip label="MACD" value={signal.indicators.macdHist?.toFixed(2)} positive={signal.indicators.macdHist !== undefined && signal.indicators.macdHist > 0} />
          <IndicatorChip label="BB Upper" value={signal.indicators.bbUpper ? `$${signal.indicators.bbUpper.toLocaleString()}` : undefined} />
          <IndicatorChip label="BB Lower" value={signal.indicators.bbLower ? `$${signal.indicators.bbLower.toLocaleString()}` : undefined} />
          <IndicatorChip label="VWAP" value={signal.indicators.vwap ? `$${signal.indicators.vwap.toLocaleString()}` : undefined} />
          <IndicatorChip label="ATR" value={signal.indicators.atr?.toFixed(0)} />
          <IndicatorChip label="CMF" value={signal.indicators.cmf?.toFixed(3)} positive={signal.indicators.cmf !== undefined && signal.indicators.cmf > 0} />
          <IndicatorChip label="Williams %R" value={signal.indicators.williamsR?.toFixed(1)} warn={signal.indicators.williamsR !== undefined && (signal.indicators.williamsR > -20 || signal.indicators.williamsR < -80)} />
          {signal.regime && (
            <div className="ml-auto text-[9px] font-mono text-dim border border-border rounded px-2 py-0.5">
              Regime: <span className="text-text font-bold">{signal.regime}</span>
            </div>
          )}
          {signal.htfBias && (
            <div className={clsx("text-[9px] font-mono font-bold border rounded px-2 py-0.5",
              signal.htfBias === "BULL" ? "text-green border-green/20" :
              signal.htfBias === "BEAR" ? "text-red border-red/20" : "text-dim border-border"
            )}>
              HTF: {signal.htfBias}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IndicatorChip({
  label, value, warn, positive,
}: {
  label: string;
  value?: string;
  warn?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-dim text-[9px] font-mono uppercase">{label}</span>
      <span className={clsx(
        "text-[10px] font-mono font-bold num",
        warn ? "text-amber" :
        positive !== undefined ? (positive ? "text-green" : "text-red") :
        "text-text"
      )}>
        {value ?? "—"}
      </span>
    </div>
  );
}
