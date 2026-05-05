// app/api/orderbook/route.ts — Live Binance order book depth

import { NextResponse } from "next/server";
import type { OrderBookSnapshot } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=20",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Binance depth failed: ${res.status}`);
    const data = await res.json();

    const bids = (data.bids as string[][]).map(([price, qty]) => ({
      price: parseFloat(price),
      qty: parseFloat(qty),
    }));
    const asks = (data.asks as string[][]).map(([price, qty]) => ({
      price: parseFloat(price),
      qty: parseFloat(qty),
    }));

    // Total bid/ask volume in top 20 levels
    const totalBidVol = bids.reduce((a, b) => a + b.qty, 0);
    const totalAskVol = asks.reduce((a, a2) => a + a2.qty, 0);

    // Imbalance: +1 = all bids, -1 = all asks
    const imbalance = (totalBidVol - totalAskVol) / (totalBidVol + totalAskVol);

    // Largest single wall
    const bidWall = Math.max(...bids.map(b => b.qty));
    const askWall = Math.max(...asks.map(a => a.qty));

    // Spread
    const spread = asks[0]?.price && bids[0]?.price
      ? asks[0].price - bids[0].price
      : 0;

    const snapshot: OrderBookSnapshot = {
      bids: bids.slice(0, 10),
      asks: asks.slice(0, 10),
      bidWall,
      askWall,
      imbalance: parseFloat(imbalance.toFixed(4)),
      spread: parseFloat(spread.toFixed(2)),
      timestamp: Date.now(),
    };

    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Order book error:", err);
    return NextResponse.json({ error: "Order book fetch failed" }, { status: 500 });
  }
}
