// app/api/market/route.ts — Real market data with microstructure analysis

import { NextResponse } from "next/server";
import type { Candle, MarketData } from "@/types";

const BINANCE = "https://api.binance.com/api/v3";
const COINGECKO = "https://api.coingecko.com/api/v3";

// Microstructure data interface
interface MicrostructureData {
  tickVelocity: number;
  orderFlowImbalance: number;
  spreadExpansion: number;
  aggressorRatio: number;
  volatilityBurst: boolean;
  syntheticPrice: number;
  priceVelocity: number;
  volumeWeightedPrice: number;
}

async function fetchCandles(interval: string, limit: number): Promise<Candle[]> {
  const res = await fetch(`${BINANCE}/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
  const data = await res.json();
  return data.map((k: number[]) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }));
}

async function fetchTicker(): Promise<{ price: number; change: number; high: number; low: number; volume: number }> {
  const [priceRes, statsRes] = await Promise.all([
    fetch(`${BINANCE}/ticker/price?symbol=BTCUSDT`, { next: { revalidate: 10 } }),
    fetch(`${BINANCE}/ticker/24hr?symbol=BTCUSDT`, { next: { revalidate: 30 } }),
  ]);
  const price = await priceRes.json();
  const stats = await statsRes.json();
  return {
    price: parseFloat(price.price),
    change: parseFloat(stats.priceChangePercent),
    high: parseFloat(stats.highPrice),
    low: parseFloat(stats.lowPrice),
    volume: parseFloat(stats.quoteVolume),
  };
}

async function fetchMultiExchange(): Promise<{ coinbase: number; kraken: number }> {
  try {
    const [cbRes, krRes] = await Promise.all([
      fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", { next: { revalidate: 30 } }),
      fetch("https://api.kraken.com/0/public/Ticker?pair=XBTUSD", { next: { revalidate: 30 } }),
    ]);
    const cb = await cbRes.json();
    const kr = await krRes.json();
    const coinbase = parseFloat(cb.data?.amount ?? "0");
    const kraken = parseFloat(kr.result?.XXBTZUSD?.c?.[0] ?? "0");
    return { coinbase, kraken };
  } catch {
    return { coinbase: 0, kraken: 0 };
  }
}

async function fetchFearGreed(): Promise<{ value: number; label: string }> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", { next: { revalidate: 3600 } });
    const data = await res.json();
    return { value: parseInt(data.data[0].value), label: data.data[0].value_classification };
  } catch {
    return { value: 50, label: "Neutral" };
  }
}

function calcHalvingDays(): number {
  const nextHalving = new Date("2028-04-01").getTime();
  return Math.max(0, Math.round((nextHalving - Date.now()) / 86400000));
}

// Calculate microstructure data from recent candles
function calculateMicrostructure(candles: Candle[]): MicrostructureData {
  const last5 = candles.slice(-5);
  const last = candles[candles.length - 1];
  
  // Tick velocity - rate of price change
  const priceChanges = last5.map((c, i) => i > 0 ? c.close - last5[i-1].close : 0);
  const avgVelocity = priceChanges.reduce((a, b) => a + Math.abs(b), 0) / 4;
  
  // Order flow imbalance
  const bullVolume = last5.filter(c => c.close >= c.open).reduce((a, c) => a + c.volume, 0);
  const bearVolume = last5.filter(c => c.close < c.open).reduce((a, c) => a + c.volume, 0);
  const totalVolume = bullVolume + bearVolume;
  const orderFlowImbalance = totalVolume > 0 ? (bullVolume - bearVolume) / totalVolume : 0;
  
  // Spread expansion (using high-low as proxy)
  const currentSpread = last.high - last.low;
  const avgSpread = last5.slice(0, 4).reduce((a, c) => a + (c.high - c.low), 0) / 4;
  const spreadExpansion = avgSpread > 0 ? currentSpread / avgSpread : 1;
  
  // Aggressor ratio
  const vwapChanges = last5.map((c, i) => {
    const vwap = (c.high + c.low + c.close) / 3;
    return i > 0 ? vwap - ((last5[i-1].high + last5[i-1].low + last5[i-1].close) / 3) : 0;
  });
  const aggressorRatio = vwapChanges.filter(v => v > 0).length / 4;
  
  // Volatility burst detection
  const atrs = last5.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = last5[i-1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  const currentATR = atrs[atrs.length - 1];
  const avgATR = atrs.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const volatilityBurst = currentATR > avgATR * 1.5;
  
  // Synthetic price (weighted average of exchanges)
  const syntheticPrice = last.close; // Would incorporate multi-exchange data in production
  
  // Price velocity
  const priceVelocity = (last.close - last5[0].close) / last5[0].close;
  
  // Volume weighted price
  const volumeWeightedPrice = last5.reduce((sum, c) => sum + (c.close * c.volume), 0) / 
    last5.reduce((sum, c) => sum + c.volume, 0);
  
  return {
    tickVelocity: avgVelocity,
    orderFlowImbalance,
    spreadExpansion,
    aggressorRatio,
    volatilityBurst,
    syntheticPrice,
    priceVelocity,
    volumeWeightedPrice
  };
}

function calcMarketCap(price: number): number {
  return price * 19_720_000; // ~circulating supply
}

export async function GET() {
  try {
    const [candles_15m, candles_1h, candles_4h, ticker, exchanges, fearGreed] = await Promise.all([
      fetchCandles("15m", 200),
      fetchCandles("1h", 100),
      fetchCandles("4h", 60),
      fetchTicker(),
      fetchMultiExchange(),
      fetchFearGreed(),
    ]);

    const agg = [ticker.price, exchanges.coinbase || ticker.price, exchanges.kraken || ticker.price]
      .filter(Boolean)
      .reduce((a, b) => a + b, 0) / 3;

    // Calculate microstructure data
    const microstructure = calculateMicrostructure(candles_15m);

    const market: MarketData = {
      price: ticker.price,
      change24h: ticker.change,
      high24h: ticker.high,
      low24h: ticker.low,
      volume24h: ticker.volume,
      marketCap: calcMarketCap(ticker.price),
      fearGreed: fearGreed.value,
      fearGreedLabel: fearGreed.label,
      binance: ticker.price,
      coinbase: exchanges.coinbase || ticker.price,
      kraken: exchanges.kraken || ticker.price,
      agg,
      candles_15m,
      candles_1h,
      candles_4h,
      halvingDays: calcHalvingDays(),
      timestamp: Date.now(),
      // Add microstructure data
      microstructure,
      syntheticPrice: microstructure.syntheticPrice,
      priceVelocity: microstructure.priceVelocity,
      volumeWeightedPrice: microstructure.volumeWeightedPrice
    };

    return NextResponse.json(market, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Market API error:", err);
    return NextResponse.json({ error: "Market data fetch failed" }, { status: 500 });
  }
}
