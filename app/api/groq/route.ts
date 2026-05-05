// app/api/groq/route.ts — Groq AI plain-English signal reasoning
// Free tier: llama-3.1-8b-instant — fast, zero cost

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { signal, indicators, price } = body;

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json({
        reasoning: "Add GROQ_API_KEY to environment variables to enable AI commentary.",
        confidence: "N/A",
        keyFactors: ["GROQ_API_KEY not configured"],
        timestamp: Date.now(),
      });
    }

    const prompt = `You are an expert BTC short-term trader analyzing a 15-minute Kalshi prediction market signal.

Current data:
- BTC Price: $${price?.toFixed(0) ?? "unknown"}
- Signal Direction: ${signal?.direction ?? "WAIT"}
- Alpha Score: ${signal?.alphaScore ?? 0}/100
- Confidence Tier: ${signal?.confidenceTier ?? "unknown"}
- RSI: ${indicators?.rsi?.toFixed(1) ?? "?"}
- MACD Hist: ${indicators?.macdHist?.toFixed(2) ?? "?"}
- Williams %R: ${indicators?.williamsR?.toFixed(1) ?? "?"}
- CCI: ${indicators?.cci?.toFixed(1) ?? "?"}
- CMF: ${indicators?.cmf?.toFixed(3) ?? "?"}
- HTF Bias: ${signal?.htfBias ?? "?"}
- ATR Gate: ${signal?.atrGate ? "OPEN (safe)" : "CLOSED (volatile)"}
- Time Window: ${signal?.timeWindowLabel ?? "?"}

In 2-3 sentences, explain in plain English:
1. WHY this signal is ${signal?.direction ?? "WAIT"}
2. The 2 most important factors driving it
3. One risk to watch

Be direct, factual, and concise. No disclaimers.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "No response";

    // Extract key factors (sentences as bullet points)
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 10).slice(0, 3);

    return NextResponse.json({
      reasoning: text,
      confidence: signal?.confidenceTier ?? "UNKNOWN",
      keyFactors: sentences.map((s: string) => s.trim()),
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Groq error:", err);
    return NextResponse.json({
      reasoning: "AI commentary unavailable. Check GROQ_API_KEY.",
      confidence: "ERROR",
      keyFactors: [],
      timestamp: Date.now(),
    });
  }
}
