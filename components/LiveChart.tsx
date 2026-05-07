"use client";
// components/LiveChart.tsx — Real-time BTC chart using lightweight-charts v5

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickSeriesOptions,
  type LineSeriesOptions,
  type HistogramSeriesOptions,
  type UTCTimestamp,
} from "lightweight-charts";
import { calcBB, calcVWAP, calcEMA, calcRSI, calcMACD } from "@/lib/indicators";
import type { Candle } from "@/types";

interface LiveChartProps {
  candles: Candle[];
}

const CHART_BG = "#0d1117";
const GRID_COLOR = "#1e2d4022";
const TEXT_COLOR = "#7a8899";

function makeChartOptions(height: number) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: CHART_BG },
      textColor: TEXT_COLOR,
      fontSize: 10,
    },
    grid: {
      vertLines: { color: GRID_COLOR },
      horzLines: { color: GRID_COLOR },
    },
    crosshair: { mode: 1 },
    rightPriceScale: { borderColor: "#1e2d40", scaleMargins: { top: 0.05, bottom: 0.05 } },
    timeScale: { borderColor: "#1e2d40", timeVisible: true, secondsVisible: false },
    height,
    handleScroll: true,
    handleScale: true,
  };
}

export function LiveChart({ candles }: LiveChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  // Series refs so we can update data without recreating chart
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMidRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rsiLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Create charts on mount
  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !macdRef.current) return;

    // ── Main chart ──────────────────────────────────────────────────────────────
    const mainChart = createChart(mainRef.current, makeChartOptions(280));
    mainChartRef.current = mainChart;

    candleSeriesRef.current = mainChart.addSeries(CandlestickSeries, {
      upColor: "#00ff88",
      downColor: "#ff3b5c",
      borderUpColor: "#00ff88",
      borderDownColor: "#ff3b5c",
      wickUpColor: "#00ff8899",
      wickDownColor: "#ff3b5c99",
    } as Partial<CandlestickSeriesOptions>);

    bbUpperRef.current = mainChart.addSeries(LineSeries, {
      color: "#00e5ff55",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    } as Partial<LineSeriesOptions>);

    bbMidRef.current = mainChart.addSeries(LineSeries, {
      color: "#00e5ff33",
      lineWidth: 1,
      lineStyle: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    } as Partial<LineSeriesOptions>);

    bbLowerRef.current = mainChart.addSeries(LineSeries, {
      color: "#00e5ff55",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    } as Partial<LineSeriesOptions>);

    vwapRef.current = mainChart.addSeries(LineSeries, {
      color: "#f5c542cc",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "VWAP",
    } as Partial<LineSeriesOptions>);

    volumeRef.current = mainChart.addSeries(HistogramSeries, {
      color: "#00e5ff22",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    } as Partial<HistogramSeriesOptions>);
    mainChart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // ── RSI chart ───────────────────────────────────────────────────────────────
    const rsiChart = createChart(rsiRef.current, {
      ...makeChartOptions(90),
      rightPriceScale: {
        borderColor: "#1e2d40",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: false,
      },
      timeScale: { borderColor: "#1e2d40", timeVisible: false, secondsVisible: false },
    });
    rsiChartRef.current = rsiChart;
    rsiChart.priceScale("right").applyOptions({ autoScale: false, minimum: 0, maximum: 100 } as Parameters<ReturnType<typeof rsiChart.priceScale>["applyOptions"]>[0]);

    rsiLineRef.current = rsiChart.addSeries(LineSeries, {
      color: "#f5c542",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "RSI",
    } as Partial<LineSeriesOptions>);

    rsi70Ref.current = rsiChart.addSeries(LineSeries, {
      color: "#ff3b5c44",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    } as Partial<LineSeriesOptions>);

    rsi30Ref.current = rsiChart.addSeries(LineSeries, {
      color: "#00ff8844",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    } as Partial<LineSeriesOptions>);

    // ── MACD chart ──────────────────────────────────────────────────────────────
    const macdChart = createChart(macdRef.current, {
      ...makeChartOptions(90),
      timeScale: { borderColor: "#1e2d40", timeVisible: true, secondsVisible: false },
    });
    macdChartRef.current = macdChart;

    macdLineRef.current = macdChart.addSeries(LineSeries, {
      color: "#00e5ff",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "MACD",
    } as Partial<LineSeriesOptions>);

    macdSignalRef.current = macdChart.addSeries(LineSeries, {
      color: "#ffaa00",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "Signal",
    } as Partial<LineSeriesOptions>);

    macdHistRef.current = macdChart.addSeries(HistogramSeries, {
      color: "#00ff8866",
      priceLineVisible: false,
      lastValueVisible: false,
    } as Partial<HistogramSeriesOptions>);

    // Sync time scales between all 3 charts
    const syncRange = (from: number, to: number) => {
      rsiChart.timeScale().setVisibleRange({ from, to } as Parameters<ReturnType<typeof rsiChart.timeScale>["setVisibleRange"]>[0]);
      macdChart.timeScale().setVisibleRange({ from, to } as Parameters<ReturnType<typeof macdChart.timeScale>["setVisibleRange"]>[0]);
    };
    mainChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (range) syncRange(range.from as number, range.to as number);
    });

    return () => {
      mainChart.remove();
      rsiChart.remove();
      macdChart.remove();
    };
  }, []);

  // Update data when candles change
  useEffect(() => {
    if (!candles || candles.length < 30) return;
    if (!candleSeriesRef.current) return;

    const closes = candles.map((c) => c.close);
    const times = candles.map((c) => c.time as UTCTimestamp);

    // Candlestick data
    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // Bollinger Bands
    const bb = calcBB(closes, 20, 2);
    const bbData = (arr: number[]) =>
      arr.map((v, i) => ({ time: times[i], value: v }));
    bbUpperRef.current?.setData(bbData(bb.upper));
    bbMidRef.current?.setData(bbData(bb.mid));
    bbLowerRef.current?.setData(bbData(bb.lower));

    // VWAP
    const vwap = calcVWAP(candles);
    vwapRef.current?.setData(vwap.map((v, i) => ({ time: times[i], value: v })));

    // Volume with color
    volumeRef.current?.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "#00ff8833" : "#ff3b5c33",
      }))
    );

    // RSI
    const rsi = calcRSI(closes, 14);
    rsiLineRef.current?.setData(rsi.map((v, i) => ({ time: times[i], value: v })));
    rsi70Ref.current?.setData(times.map((t) => ({ time: t, value: 70 })));
    rsi30Ref.current?.setData(times.map((t) => ({ time: t, value: 30 })));

    // MACD
    const { macd, signal, hist } = calcMACD(closes);
    macdLineRef.current?.setData(macd.map((v, i) => ({ time: times[i], value: v })));
    macdSignalRef.current?.setData(signal.map((v, i) => ({ time: times[i], value: v })));
    macdHistRef.current?.setData(
      hist.map((v, i) => ({
        time: times[i],
        value: v,
        color: v >= 0 ? "#00ff8866" : "#ff3b5c66",
      }))
    );

    // Fit content on first load
    mainChartRef.current?.timeScale().fitContent();
    rsiChartRef.current?.timeScale().fitContent();
    macdChartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Handle container resize
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (mainRef.current) mainChartRef.current?.applyOptions({ width: mainRef.current.clientWidth });
      if (rsiRef.current) rsiChartRef.current?.applyOptions({ width: rsiRef.current.clientWidth });
      if (macdRef.current) macdChartRef.current?.applyOptions({ width: macdRef.current.clientWidth });
    });
    if (mainRef.current) obs.observe(mainRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-0 bg-surface rounded-lg overflow-hidden border border-border">
      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border bg-panel">
        <span className="text-dim text-[9px] font-mono uppercase tracking-widest">BTC/USDT · 15m</span>
        <span className="flex items-center gap-1 text-[9px] font-mono">
          <span className="inline-block w-3 h-px bg-[#00e5ff55] border-t-2 border-dashed border-[#00e5ff55]" />
          <span className="text-dim">BB</span>
        </span>
        <span className="flex items-center gap-1 text-[9px] font-mono">
          <span className="inline-block w-3 h-0.5 bg-[#f5c542]" />
          <span className="text-dim">VWAP</span>
        </span>
        <span className="flex items-center gap-1 text-[9px] font-mono">
          <span className="inline-block w-3 h-0.5 bg-[#00e5ff22]" />
          <span className="text-dim">VOL</span>
        </span>
      </div>
      <div ref={mainRef} className="w-full" />

      {/* RSI legend */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-border bg-panel">
        <span className="text-dim text-[9px] font-mono uppercase tracking-widest">RSI(14)</span>
        <span className="text-[9px] font-mono text-[#ff3b5c66]">— 70</span>
        <span className="text-[9px] font-mono text-[#00ff8866]">— 30</span>
      </div>
      <div ref={rsiRef} className="w-full" />

      {/* MACD legend */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-border bg-panel">
        <span className="text-dim text-[9px] font-mono uppercase tracking-widest">MACD(12,26,9)</span>
        <span className="flex items-center gap-1 text-[9px] font-mono">
          <span className="inline-block w-3 h-0.5 bg-[#00e5ff]" />
          <span className="text-dim">MACD</span>
        </span>
        <span className="flex items-center gap-1 text-[9px] font-mono">
          <span className="inline-block w-3 h-0.5 bg-[#ffaa00]" />
          <span className="text-dim">Signal</span>
        </span>
      </div>
      <div ref={macdRef} className="w-full" />
    </div>
  );
}
