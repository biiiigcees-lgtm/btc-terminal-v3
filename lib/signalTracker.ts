// lib/signalTracker.ts — Auto-tracks every signal fired vs actual outcome

import type { SignalAccuracyEntry } from "@/types";

// Stored in-memory and persisted via Zustand
export function createAccuracyEntry(
  direction: "ABOVE" | "BELOW" | "WAIT",
  alpha: number,
  confidenceTier: string,
  entryPrice: number
): SignalAccuracyEntry {
  return {
    id: `sig_${Date.now()}`,
    timestamp: Date.now(),
    direction,
    alpha,
    confidenceTier,
    entryPrice,
    resolvedPrice: null,
    correct: null,
    resolved: false,
  };
}

export function resolveAccuracyEntry(
  entry: SignalAccuracyEntry,
  currentPrice: number
): SignalAccuracyEntry {
  if (entry.direction === "WAIT") {
    return { ...entry, resolved: true, resolvedPrice: currentPrice, correct: null };
  }
  const correct = entry.direction === "ABOVE"
    ? currentPrice > entry.entryPrice
    : currentPrice < entry.entryPrice;
  return { ...entry, resolved: true, resolvedPrice: currentPrice, correct };
}

export function calcAccuracyStats(entries: SignalAccuracyEntry[]) {
  const resolved = entries.filter(e => e.resolved && e.correct !== null);
  const correct = resolved.filter(e => e.correct).length;
  const total = resolved.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  // By alpha bracket
  const brackets = [
    { label: "60–69", lo: 60, hi: 70 },
    { label: "70–79", lo: 70, hi: 80 },
    { label: "80–89", lo: 80, hi: 90 },
    { label: "90+",   lo: 90, hi: 101 },
  ];

  const byBracket = brackets.map(({ label, lo, hi }) => {
    const bt = resolved.filter(e => e.alpha >= lo && e.alpha < hi);
    const bw = bt.filter(e => e.correct).length;
    return {
      label,
      trades: bt.length,
      correct: bw,
      accuracy: bt.length > 0 ? Math.round((bw / bt.length) * 100) : 0,
    };
  });

  // Optimal alpha — bracket with highest accuracy and >= 5 samples
  const optimal = byBracket
    .filter(b => b.trades >= 5)
    .sort((a, b) => b.accuracy - a.accuracy)[0];

  return { total, correct, accuracy, byBracket, optimalAlpha: optimal?.label ?? "Need more data" };
}
