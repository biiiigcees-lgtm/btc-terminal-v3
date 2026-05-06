// app/api/kalshi/order/route.ts — Kalshi order execution endpoint
// Set KALSHI_API_KEY in env to activate real orders; omit for simulated fills.

import { NextRequest, NextResponse } from "next/server";

const VALID_SIDES = new Set(["ABOVE", "BELOW"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { market, side, size } = body;

    // Input validation
    if (typeof market !== "string" || market.trim().length === 0) {
      return NextResponse.json({ error: "Invalid market ticker" }, { status: 400 });
    }
    if (!VALID_SIDES.has(side)) {
      return NextResponse.json({ error: "side must be ABOVE or BELOW" }, { status: 400 });
    }
    if (typeof size !== "number" || !isFinite(size) || size <= 0 || size > 10000) {
      return NextResponse.json({ error: "size must be a positive number ≤ 10000" }, { status: 400 });
    }

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
