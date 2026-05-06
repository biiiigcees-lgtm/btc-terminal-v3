// app/api/kalshi/order/route.ts — Kalshi order execution endpoint
// Set KALSHI_API_KEY in env to activate real orders; omit for simulated fills.

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { market, side, size } = await req.json();

    const apiKey = process.env.KALSHI_API_KEY;
    if (apiKey) {
      const kalshiRes = await fetch(
        "https://trading-api.kalshi.com/trade-api/v2/portfolio/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            ticker: market,
            side: side === "ABOVE" ? "yes" : "no",
            type: "market",
            count: Math.round(size * 100), // Kalshi counts in cents
          }),
        }
      );
      const data = await kalshiRes.json();
      return NextResponse.json({
        status: kalshiRes.ok ? "FILLED" : "REJECTED",
        orderId: data.order?.order_id,
        price: data.order?.avg_price ? data.order.avg_price / 100 : 1.0,
        size: data.order?.count ? data.order.count / 100 : size,
        live: true,
      });
    }

    // No API key — return a simulated fill so the execution loop can run safely
    return NextResponse.json({
      status: "FILLED",
      orderId: `sim_${Date.now()}`,
      price: 1.0,
      size,
      live: false,
      simulated: true,
    });
  } catch (err) {
    console.error("Kalshi order error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
