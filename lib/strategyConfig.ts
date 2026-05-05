// lib/strategyConfig.ts — Kalshi-specific strategy modes and edge threshold mapping

export type StrategyMode = "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";

export interface StrategyConfig {
  mode: StrategyMode;
  label: string;
  emoji: string;
  description: string;
  evFloor: number;           // minimum EV to trade
  probFloor: number;         // minimum win probability (%)
  agreementFloor: number;    // minimum consensus agreement (%)
  dissentCeiling: number;    // maximum allowed dissent (%)
  kellyMultiplier: number;   // multiplier on kelly bet size
  alphaFloor: number;        // minimum alpha score to trade
  accentColor: string;       // tailwind color token (bg-)
  textColor: string;         // tailwind color token (text-)
  borderColor: string;       // tailwind color token (border-)
}

export const STRATEGY_CONFIGS: Record<StrategyMode, StrategyConfig> = {
  AGGRESSIVE: {
    mode: "AGGRESSIVE",
    label: "AGGRESSIVE",
    emoji: "🔥",
    description: "Max trade frequency. Lower entry bars, higher position risk. Best for experienced traders in trending markets.",
    evFloor: 0.02,
    probFloor: 55,
    agreementFloor: 55,
    dissentCeiling: 30,
    kellyMultiplier: 1.0,
    alphaFloor: 60,
    accentColor: "bg-red",
    textColor: "text-red",
    borderColor: "border-red",
  },
  BALANCED: {
    mode: "BALANCED",
    label: "BALANCED",
    emoji: "⚖️",
    description: "Default EV-first mode. Disciplined filtering with proven thresholds. Optimal for most market conditions.",
    evFloor: 0.06,
    probFloor: 60,
    agreementFloor: 65,
    dissentCeiling: 20,
    kellyMultiplier: 0.5,
    alphaFloor: 70,
    accentColor: "bg-amber",
    textColor: "text-amber",
    borderColor: "border-amber",
  },
  CONSERVATIVE: {
    mode: "CONSERVATIVE",
    label: "CONSERVATIVE",
    emoji: "🛡️",
    description: "Capital preservation mode. Only elite setups with overwhelming consensus. Fewer trades, higher precision.",
    evFloor: 0.10,
    probFloor: 70,
    agreementFloor: 75,
    dissentCeiling: 15,
    kellyMultiplier: 0.25,
    alphaFloor: 80,
    accentColor: "bg-green",
    textColor: "text-green",
    borderColor: "border-green",
  },
};

// Maps edgeThreshold slider (0–100) to live parameter values.
// 0 = maximally aggressive, 100 = maximally conservative.
export function edgeThresholdToParams(threshold: number): {
  evFloor: number;
  probFloor: number;
  agreementFloor: number;
  dissentCeiling: number;
  kellyMultiplier: number;
  alphaFloor: number;
  label: string;
} {
  const t = Math.max(0, Math.min(100, threshold)) / 100;
  return {
    evFloor:          parseFloat((0.02 + t * 0.10).toFixed(3)),
    probFloor:        Math.round(55 + t * 20),
    agreementFloor:   Math.round(55 + t * 25),
    dissentCeiling:   Math.round(35 - t * 25),
    kellyMultiplier:  parseFloat((1.0 - t * 0.75).toFixed(3)),
    alphaFloor:       Math.round(60 + t * 25),
    label:
      threshold <= 20 ? "VERY AGGRESSIVE"
      : threshold <= 40 ? "AGGRESSIVE"
      : threshold <= 60 ? "BALANCED"
      : threshold <= 80 ? "CONSERVATIVE"
      : "VERY CONSERVATIVE",
  };
}

// Infer the closest StrategyMode from an edge threshold value
export function thresholdToMode(threshold: number): StrategyMode {
  if (threshold <= 33) return "AGGRESSIVE";
  if (threshold <= 66) return "BALANCED";
  return "CONSERVATIVE";
}

// Get the canonical threshold for a given mode
export function modeToThreshold(mode: StrategyMode): number {
  return mode === "AGGRESSIVE" ? 15 : mode === "BALANCED" ? 50 : 85;
}
