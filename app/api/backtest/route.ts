// app/api/backtest/route.ts — Run backtest on demand

import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/market`, { cache: "no-store" });
    if (!res.ok) throw new Error("Market fetch failed");
    const market = await res.json();

    const { candles_15m, candles_1h, candles_4h } = market;
    if (!candles_15m || candles_15m.length < 100) {
      return NextResponse.json({ error: "Need at least 100 candles" }, { status: 400 });
    }

    const result = runBacktest(candles_15m, candles_1h, candles_4h);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Backtest error:", err);
    return NextResponse.json({ error: "Backtest failed" }, { status: 500 });
  }
}
