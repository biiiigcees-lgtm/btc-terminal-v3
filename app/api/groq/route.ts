// app/api/groq/route.ts — Groq AI betting analysis with EMA context
// Model: llama-3.3-70b-versatile — best quality on free tier

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { signal, indicators, price, ema9, ema21, crossoverStatus, candlesSinceCross } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({
        action: "WAIT",
        timing: "N/A",
        reasoning: "Add GROQ_API_KEY to environment variables to enable AI analysis.",
        confidence: "N/A",
        keyFactors: ["GROQ_API_KEY not configured"],
        risks: [],
        timestamp: Date.now(),
      });
    }

    const ema9Dist = ema9 && price ? (((price - ema9) / ema9) * 100).toFixed(2) : "?";
    const ema21Dist = ema21 && price ? (((price - ema21) / ema21) * 100).toFixed(2) : "?";
    const ema9AboveEma21 = ema9 && ema21 ? ema9 > ema21 : null;

    const prompt = `You are an expert BTC short-term trader. Analyze this 15-minute chart data and provide a clear betting recommendation.

PRICE & EMA DATA:
- BTC Price: $${price?.toFixed(0) ?? "unknown"}
- EMA 9: $${ema9?.toFixed(0) ?? "?"} (price is ${ema9Dist}% ${parseFloat(ema9Dist) >= 0 ? "above" : "below"} EMA9)
- EMA 21: $${ema21?.toFixed(0) ?? "?"} (price is ${ema21Dist}% ${parseFloat(ema21Dist) >= 0 ? "above" : "below"} EMA21)
- EMA 9 vs EMA 21: ${ema9AboveEma21 === true ? "EMA9 ABOVE EMA21 (bullish alignment)" : ema9AboveEma21 === false ? "EMA9 BELOW EMA21 (bearish alignment)" : "?"}
- Crossover status: ${crossoverStatus ?? "UNKNOWN"}${candlesSinceCross >= 0 ? `, ${candlesSinceCross} candle(s) ago` : ""}

SIGNAL ENGINE:
- Direction: ${signal?.direction ?? "WAIT"}
- Alpha Score: ${signal?.alphaScore ?? 0}/100
- Confidence Tier: ${signal?.confidenceTier ?? "unknown"}
- Market Regime: ${signal?.regime ?? "?"}
- HTF Bias: ${signal?.htfBias ?? "?"}
- ATR Gate: ${signal?.atrGate ? "OPEN (safe to bet)" : "CLOSED (too volatile)"}
- Time Window: ${signal?.timeWindowLabel ?? "?"}

TECHNICAL INDICATORS:
- RSI(14): ${indicators?.rsi?.toFixed(1) ?? "?"}
- MACD Histogram: ${indicators?.macdHist?.toFixed(2) ?? "?"}
- Williams %R: ${indicators?.williamsR?.toFixed(1) ?? "?"}
- CCI: ${indicators?.cci?.toFixed(1) ?? "?"}
- CMF: ${indicators?.cmf?.toFixed(3) ?? "?"}
- BB Upper/Lower: $${indicators?.bbUpper?.toFixed(0) ?? "?"} / $${indicators?.bbLower?.toFixed(0) ?? "?"}
- VWAP: $${indicators?.vwap?.toFixed(0) ?? "?"}

Respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "action": "BUY" or "SELL" or "WAIT",
  "timing": "NOW" or "NEXT CANDLE" or "WAIT FOR PULLBACK" or "SKIP",
  "reasoning": "2-3 sentence explanation of WHY this action and timing",
  "keyFactors": ["factor 1", "factor 2", "factor 3"],
  "risks": ["risk 1", "risk 2"]
}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 350,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: {
      action?: string;
      timing?: string;
      reasoning?: string;
      keyFactors?: string[];
      risks?: string[];
    } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Fallback: extract from text
      parsed = {
        action: signal?.direction === "ABOVE" ? "BUY" : signal?.direction === "BELOW" ? "SELL" : "WAIT",
        timing: "NEXT CANDLE",
        reasoning: text.slice(0, 300),
        keyFactors: [],
        risks: [],
      };
    }

    return NextResponse.json({
      action: parsed.action ?? "WAIT",
      timing: parsed.timing ?? "NEXT CANDLE",
      reasoning: parsed.reasoning ?? "Analysis unavailable.",
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      confidence: signal?.confidenceTier ?? "UNKNOWN",
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Groq error:", err);
    return NextResponse.json({
      action: "WAIT",
      timing: "N/A",
      reasoning: "AI analysis temporarily unavailable.",
      confidence: "ERROR",
      keyFactors: [],
      risks: [],
      timestamp: Date.now(),
    });
  }
}
