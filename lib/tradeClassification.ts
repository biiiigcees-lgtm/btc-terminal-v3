// lib/tradeClassification.ts — Trade class enforcement with color coding

export interface TradeClass {
  level: "HIGH_EDGE" | "MEDIUM" | "LOW" | "NO_TRADE";
  color: string;
  backgroundColor: string;
  borderColor: string;
  priority: number; // 1 = highest priority
  description: string;
  shouldDisplay: boolean;
  opacity: number;
  visualPriority: "GREEN" | "YELLOW" | "GRAY" | "RED";
  urgency: "NORMAL" | "CAUTION" | "LOW" | "DANGER";
}

export interface ClassificationCriteria {
  evThreshold: {
    high: number;
    medium: number;
    low: number;
  };
  probabilityThreshold: {
    high: number;
    medium: number;
    low: number;
  };
  confidenceThreshold: {
    high: number;
    medium: number;
    low: number;
  };
}

// Default classification thresholds
const DEFAULT_CRITERIA: ClassificationCriteria = {
  evThreshold: {
    high: 0.05,
    medium: 0.02,
    low: 0.01
  },
  probabilityThreshold: {
    high: 75,
    medium: 60,
    low: 55
  },
  confidenceThreshold: {
    high: 80,
    medium: 65,
    low: 50
  }
};

// VISUAL PRIORITY SYSTEM - GREEN/YELLOW/GRAY/RED color scheme
const TRADE_COLORS = {
  HIGH_EDGE: {
    color: "#10b981",      // GREEN - strong opportunity
    backgroundColor: "#064e3b", // emerald-900
    borderColor: "#34d399",    // emerald-400
    priority: 1,
    description: "High Edge - Strong Opportunity",
    shouldDisplay: true,
    opacity: 1,
    visualPriority: "GREEN",
    urgency: "NORMAL"
  },
  MEDIUM: {
    color: "#f59e0b",      // YELLOW - moderate opportunity
    backgroundColor: "#78350f", // amber-900
    borderColor: "#fbbf24",    // amber-400
    priority: 2,
    description: "Medium Edge - Consider",
    shouldDisplay: true,
    opacity: 0.85,
    visualPriority: "YELLOW",
    urgency: "CAUTION"
  },
  LOW: {
    color: "#6b7280",      // GRAY - weak signal
    backgroundColor: "#1f2937", // gray-800
    borderColor: "#9ca3af",    // gray-400
    priority: 3,
    description: "Low Edge - Weak Signal",
    shouldDisplay: true,
    opacity: 0.6,
    visualPriority: "GRAY",
    urgency: "LOW"
  },
  NO_TRADE: {
    color: "#ef4444",      // RED - dangerous, no trade
    backgroundColor: "#7f1d1d", // red-900
    borderColor: "#f87171",    // red-400
    priority: 4,
    description: "No Edge - Do Not Trade",
    shouldDisplay: false,
    opacity: 0.4,
    visualPriority: "RED",
    urgency: "DANGER"
  }
};

// Classify trade based on EV, probability, and confidence
export function classifyTrade(
  ev: number,
  probability: number,
  confidence: number,
  customCriteria?: Partial<ClassificationCriteria>
): TradeClass {
  const criteria = { ...DEFAULT_CRITERIA, ...customCriteria };
  
  // NO TRADE rule - hard filters
  if (ev <= 0 || probability < 55) {
    return {
      ...TRADE_COLORS.NO_TRADE,
      level: "NO_TRADE"
    };
  }
  
  // Check for HIGH edge
  const isHighEV = ev >= criteria.evThreshold.high;
  const isHighProb = probability >= criteria.probabilityThreshold.high;
  const isHighConf = confidence >= criteria.confidenceThreshold.high;
  
  if (isHighEV && isHighProb && isHighConf) {
    return {
      ...TRADE_COLORS.HIGH_EDGE,
      level: "HIGH_EDGE"
    };
  }
  
  // Check for MEDIUM edge
  const isMediumEV = ev >= criteria.evThreshold.medium;
  const isMediumProb = probability >= criteria.probabilityThreshold.medium;
  const isMediumConf = confidence >= criteria.confidenceThreshold.medium;
  
  if ((isMediumEV && isMediumProb) || (isHighEV && isMediumConf) || (isHighProb && isMediumConf)) {
    return {
      ...TRADE_COLORS.MEDIUM,
      level: "MEDIUM"
    };
  }
  
  // Check for LOW edge
  const isLowEV = ev >= criteria.evThreshold.low;
  const isLowProb = probability >= criteria.probabilityThreshold.low;
  const isLowConf = confidence >= criteria.confidenceThreshold.low;
  
  if (isLowEV && isLowProb && isLowConf) {
    return {
      ...TRADE_COLORS.LOW,
      level: "LOW"
    };
  }
  
  // Default to NO TRADE
  return {
    ...TRADE_COLORS.NO_TRADE,
    level: "NO_TRADE"
  };
}

// Get CSS classes for trade styling
export function getTradeClassCSS(tradeClass: TradeClass): string {
  return `
    color: ${tradeClass.color};
    background-color: ${tradeClass.backgroundColor};
    border-color: ${tradeClass.borderColor};
    opacity: ${tradeClass.opacity};
    border-width: 2px;
    border-style: solid;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    text-align: center;
    transition: all 0.2s ease-in-out;
  `;
}

// Get display priority for UI ordering
export function getDisplayPriority(tradeClass: TradeClass): number {
  return tradeClass.priority;
}

// Determine if trade should be highlighted
export function shouldHighlightTrade(tradeClass: TradeClass): boolean {
  return tradeClass.level === "HIGH_EDGE";
}

// Get trade class badge for UI
export function getTradeClassBadge(tradeClass: TradeClass): {
  text: string;
  style: React.CSSProperties;
  show: boolean;
} {
  return {
    text: tradeClass.level.replace("_", " "),
    style: {
      backgroundColor: tradeClass.backgroundColor,
      color: tradeClass.color,
      border: `2px solid ${tradeClass.borderColor}`,
      opacity: tradeClass.opacity,
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "uppercase"
    },
    show: tradeClass.shouldDisplay
  };
}

// Filter trades by class level
export function filterTradesByClass(
  trades: any[],
  minimumLevel: "HIGH_EDGE" | "MEDIUM" | "LOW" | "NO_TRADE"
): any[] {
  const levelOrder = ["HIGH_EDGE", "MEDIUM", "LOW", "NO_TRADE"];
  const minIndex = levelOrder.indexOf(minimumLevel);
  
  return trades.filter(trade => {
    const tradeClass = classifyTrade(trade.ev, trade.probability, trade.confidence);
    const tradeIndex = levelOrder.indexOf(tradeClass.level);
    return tradeIndex <= minIndex;
  });
}

// Get trade class statistics
export function getTradeClassStats(trades: any[]): {
  [key: string]: {
    count: number;
    percentage: number;
    avgEV: number;
    avgProbability: number;
    avgConfidence: number;
  };
} {
  const stats: any = {};
  const totalTrades = trades.length;
  
  ["HIGH_EDGE", "MEDIUM", "LOW", "NO_TRADE"].forEach(level => {
    const levelTrades = trades.filter(trade => {
      const tradeClass = classifyTrade(trade.ev, trade.probability, trade.confidence);
      return tradeClass.level === level;
    });
    
    stats[level] = {
      count: levelTrades.length,
      percentage: totalTrades > 0 ? (levelTrades.length / totalTrades) * 100 : 0,
      avgEV: levelTrades.length > 0 ? levelTrades.reduce((sum, t) => sum + t.ev, 0) / levelTrades.length : 0,
      avgProbability: levelTrades.length > 0 ? levelTrades.reduce((sum, t) => sum + t.probability, 0) / levelTrades.length : 0,
      avgConfidence: levelTrades.length > 0 ? levelTrades.reduce((sum, t) => sum + t.confidence, 0) / levelTrades.length : 0
    };
  });
  
  return stats;
}

// Quick classification for UI decisions
export function quickClassify(ev: number, probability: number): "SHOW" | "HIDE" | "MUTE" {
  if (ev <= 0 || probability < 55) return "HIDE";
  if (ev >= 0.05 && probability >= 75) return "SHOW";
  if (ev >= 0.02 && probability >= 60) return "SHOW";
  return "MUTE";
}
