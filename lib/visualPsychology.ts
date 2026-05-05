// lib/visualPsychology.ts — VISUAL PSYCHOLOGY: Green=act, Yellow=caution, Gray=no trade, Red=danger

export interface VisualPsychologyState {
  primaryColor: "GREEN" | "YELLOW" | "GRAY" | "RED";
  actionLevel: "EXECUTE" | "CONSIDER" | "WAIT" | "AVOID";
  psychologicalImpact: "CONFIDENT" | "CAUTIOUS" | "PATIENT" | "ALERT";
  userBehavior: "PROACTIVE" | "ANALYTICAL" | "PASSIVE" | "DEFENSIVE";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  clarity: "CLEAR" | "MODERATE" | "MUDDLED" | "CONFUSED";
}

export interface VisualPsychologyConfig {
  colors: {
    green: string;
    yellow: string;
    gray: string;
    red: string;
  };
  backgroundColors: {
    green: string;
    yellow: string;
    gray: string;
    red: string;
  };
  borderColors: {
    green: string;
    yellow: string;
    gray: string;
    red: string;
  };
  opacity: {
    green: number;
    yellow: number;
    gray: number;
    red: number;
  };
  animations: {
    pulse: boolean;
    glow: boolean;
    fade: boolean;
  };
}

export interface VisualPsychologyResult {
  state: VisualPsychologyState;
  config: VisualPsychologyConfig;
  message: string;
  subtext: string;
  icon: string;
  userGuidance: string[];
  behavioralNudges: string[];
  psychologicalTriggers: string[];
}

// Visual psychology color mappings
const VISUAL_COLORS = {
  GREEN: {
    primary: "#10b981",      // emerald-500
    background: "#064e3b",   // emerald-900
    border: "#34d399",       // emerald-400
    opacity: 1.0,
    message: "ACT",
    subtext: "Strong opportunity",
    icon: "🟢",
    psychological: "CONFIDENT",
    behavior: "PROACTIVE"
  },
  YELLOW: {
    primary: "#f59e0b",      // amber-500
    background: "#78350f",   // amber-900
    border: "#fbbf24",       // amber-400
    opacity: 0.85,
    message: "CAUTION",
    subtext: "Moderate opportunity",
    icon: "🟡",
    psychological: "CAUTIOUS",
    behavior: "ANALYTICAL"
  },
  GRAY: {
    primary: "#6b7280",      // gray-500
    background: "#1f2937",   // gray-800
    border: "#9ca3af",       // gray-400
    opacity: 0.7,
    message: "WAIT",
    subtext: "No clear edge",
    icon: "⚪",
    psychological: "PATIENT",
    behavior: "PASSIVE"
  },
  RED: {
    primary: "#ef4444",      // red-500
    background: "#7f1d1d",   // red-900
    border: "#f87171",       // red-400
    opacity: 0.9,
    message: "AVOID",
    subtext: "Danger detected",
    icon: "🔴",
    psychological: "ALERT",
    behavior: "DEFENSIVE"
  }
};

// Calculate visual psychology state based on trade metrics
export function calculateVisualPsychologyState(
  edgeScore: number,
  confidence: number,
  ev: number,
  probability: number,
  riskLevel: number,
  urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME" = "LOW"
): VisualPsychologyState {
  // Determine primary color based on edge score and confidence
  let primaryColor: "GREEN" | "YELLOW" | "GRAY" | "RED";
  let actionLevel: "EXECUTE" | "CONSIDER" | "WAIT" | "AVOID";
  let psychologicalImpact: "CONFIDENT" | "CAUTIOUS" | "PATIENT" | "ALERT";
  let userBehavior: "PROACTIVE" | "ANALYTICAL" | "PASSIVE" | "DEFENSIVE";
  let clarity: "CLEAR" | "MODERATE" | "MUDDLED" | "CONFUSED";

  // GREEN conditions - strong signal to act
  if (edgeScore >= 85 && confidence >= 75 && ev >= 0.06 && probability >= 65) {
    primaryColor = "GREEN";
    actionLevel = "EXECUTE";
    psychologicalImpact = "CONFIDENT";
    userBehavior = "PROACTIVE";
    clarity = "CLEAR";
  }
  // YELLOW conditions - moderate signal, be cautious
  else if (edgeScore >= 70 && confidence >= 60 && ev >= 0.04 && probability >= 55) {
    primaryColor = "YELLOW";
    actionLevel = "CONSIDER";
    psychologicalImpact = "CAUTIOUS";
    userBehavior = "ANALYTICAL";
    clarity = "MODERATE";
  }
  // RED conditions - dangerous, avoid
  else if (edgeScore < 50 || confidence < 40 || ev <= 0 || probability < 45 || riskLevel > 0.8) {
    primaryColor = "RED";
    actionLevel = "AVOID";
    psychologicalImpact = "ALERT";
    userBehavior = "DEFENSIVE";
    clarity = urgencyLevel === "EXTREME" ? "MUDDLED" : "CLEAR";
  }
  // GRAY conditions - no clear edge, wait
  else {
    primaryColor = "GRAY";
    actionLevel = "WAIT";
    psychologicalImpact = "PATIENT";
    userBehavior = "PASSIVE";
    clarity = "MUDDLED";
  }

  return {
    primaryColor,
    actionLevel,
    psychologicalImpact,
    userBehavior,
    urgency: urgencyLevel,
    clarity
  };
}

// Generate visual psychology configuration
export function generateVisualPsychologyConfig(
  state: VisualPsychologyState,
  enableAnimations: boolean = true
): VisualPsychologyConfig {
  const color = VISUAL_COLORS[state.primaryColor];

  return {
    colors: {
      green: VISUAL_COLORS.GREEN.primary,
      yellow: VISUAL_COLORS.YELLOW.primary,
      gray: VISUAL_COLORS.GRAY.primary,
      red: VISUAL_COLORS.RED.primary
    },
    backgroundColors: {
      green: VISUAL_COLORS.GREEN.background,
      yellow: VISUAL_COLORS.YELLOW.background,
      gray: VISUAL_COLORS.GRAY.background,
      red: VISUAL_COLORS.RED.background
    },
    borderColors: {
      green: VISUAL_COLORS.GREEN.border,
      yellow: VISUAL_COLORS.YELLOW.border,
      gray: VISUAL_COLORS.GRAY.border,
      red: VISUAL_COLORS.RED.border
    },
    opacity: {
      green: VISUAL_COLORS.GREEN.opacity,
      yellow: VISUAL_COLORS.YELLOW.opacity,
      gray: VISUAL_COLORS.GRAY.opacity,
      red: VISUAL_COLORS.RED.opacity
    },
    animations: {
      pulse: enableAnimations && state.primaryColor === "GREEN",
      glow: enableAnimations && (state.primaryColor === "GREEN" || state.primaryColor === "RED"),
      fade: enableAnimations && state.primaryColor === "GRAY"
    }
  };
}

// Create visual psychology result
export function createVisualPsychologyResult(
  state: VisualPsychologyState,
  config: VisualPsychologyConfig,
  tradeDetails?: {
    direction: string;
    ev: number;
    probability: number;
    confidence: number;
  }
): VisualPsychologyResult {
  const color = VISUAL_COLORS[state.primaryColor];
  
  // Generate user guidance based on psychological state
  const userGuidance: string[] = [];
  const behavioralNudges: string[] = [];
  const psychologicalTriggers: string[] = [];

  switch (state.primaryColor) {
    case "GREEN":
      userGuidance.push("Strong statistical edge detected");
      userGuidance.push("High confidence in outcome");
      userGuidance.push("Favorable risk/reward ratio");
      
      behavioralNudges.push("Act decisively when conditions align");
      behavioralNudges.push("Maintain position size discipline");
      behavioralNudges.push("Set clear profit targets");
      
      psychologicalTriggers.push("Confidence from strong consensus");
      psychologicalTriggers.push("Urgency from high probability");
      psychologicalTriggers.push("Motivation from positive EV");
      break;
      
    case "YELLOW":
      userGuidance.push("Moderate opportunity exists");
      userGuidance.push("Some uncertainty present");
      userGuidance.push("Additional analysis recommended");
      
      behavioralNudges.push("Proceed with caution");
      behavioralNudges.push("Consider reduced position size");
      behavioralNudges.push("Monitor for confirmation signals");
      
      psychologicalTriggers.push("Caution from mixed signals");
      psychologicalTriggers.push("Analysis paralysis risk");
      psychologicalTriggers.push("FOMO from moderate edge");
      break;
      
    case "GRAY":
      userGuidance.push("No clear statistical advantage");
      userGuidance.push("Market conditions uncertain");
      userGuidance.push("Patience is the best strategy");
      
      behavioralNudges.push("Wait for better setup");
      behavioralNudges.push("Avoid forcing trades");
      behavioralNudges.push("Focus on capital preservation");
      
      psychologicalTriggers.push("Patience from lack of edge");
      psychologicalTriggers.push("Frustration from inactivity");
      psychologicalTriggers.push("Discipline from rules");
      break;
      
    case "RED":
      userGuidance.push("High risk detected");
      userGuidance.push("Statistical disadvantage");
      userGuidance.push("Potential for significant loss");
      
      behavioralNudges.push("Avoid this trade entirely");
      behavioralNudges.push("Protect capital at all costs");
      behavioralNudges.push("Review risk management rules");
      
      psychologicalTriggers.push("Fear from high risk");
      psychologicalTriggers.push("Relief from avoiding loss");
      psychologicalTriggers.push("Discipline from following rules");
      break;
  }

  // Add urgency-based guidance
  if (state.urgency === "EXTREME") {
    userGuidance.push("Time critical - act quickly if GREEN");
    behavioralNudges.push("Reduce analysis time");
    psychologicalTriggers.push("Stress from time pressure");
  }

  // Format message with trade details
  let message = color.message;
  let subtext = color.subtext;
  
  if (tradeDetails && state.primaryColor !== "GRAY") {
    message = `${color.message}: ${tradeDetails.direction}`;
    subtext = `EV: ${tradeDetails.ev.toFixed(3)} | ${tradeDetails.probability}% | ${tradeDetails.confidence}%`;
  }

  return {
    state,
    config,
    message,
    subtext,
    icon: color.icon,
    userGuidance,
    behavioralNudges,
    psychologicalTriggers
  };
}

// Get psychological impact assessment
export function getPsychologicalImpactAssessment(
  currentState: VisualPsychologyState,
  previousState: VisualPsychologyState | null
): {
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  change: "IMPROVING" | "DECLINING" | "STABLE";
  userStress: "LOW" | "MEDIUM" | "HIGH";
  decisionQuality: "HIGH" | "MEDIUM" | "LOW";
  recommendations: string[];
} {
  const colorPriority = { GREEN: 4, YELLOW: 3, GRAY: 2, RED: 1 };
  const currentPriority = colorPriority[currentState.primaryColor];
  
  let impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL" = "NEUTRAL";
  let change: "IMPROVING" | "DECLINING" | "STABLE" = "STABLE";
  let userStress: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let decisionQuality: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  const recommendations: string[] = [];

  // Determine impact
  if (currentPriority >= 3) {
    impact = "POSITIVE";
  } else if (currentPriority <= 2) {
    impact = "NEGATIVE";
  }

  // Determine change from previous state
  if (previousState) {
    const previousPriority = colorPriority[previousState.primaryColor];
    if (currentPriority > previousPriority) {
      change = "IMPROVING";
    } else if (currentPriority < previousPriority) {
      change = "DECLINING";
    }
  }

  // Determine user stress
  if (currentState.primaryColor === "RED" || currentState.urgency === "EXTREME") {
    userStress = "HIGH";
  } else if (currentState.primaryColor === "YELLOW" || currentState.urgency === "HIGH") {
    userStress = "MEDIUM";
  } else {
    userStress = "LOW";
  }

  // Determine decision quality
  if (currentState.primaryColor === "GREEN" && currentState.clarity === "CLEAR") {
    decisionQuality = "HIGH";
  } else if (currentState.primaryColor === "RED" || currentState.clarity === "MUDDLED") {
    decisionQuality = "LOW";
  } else {
    decisionQuality = "MEDIUM";
  }

  // Generate recommendations
  if (userStress === "HIGH") {
    recommendations.push("Take a break to reduce stress");
    recommendations.push("Focus on risk management");
  }
  
  if (decisionQuality === "LOW") {
    recommendations.push("Wait for clearer signals");
    recommendations.push("Avoid forcing decisions");
  }
  
  if (change === "DECLINING") {
    recommendations.push("Review recent performance");
    recommendations.push("Consider strategy adjustment");
  }

  return {
    impact,
    change,
    userStress,
    decisionQuality,
    recommendations
  };
}

// Apply visual psychology to UI components
export function applyVisualPsychologyToUI(
  result: VisualPsychologyResult
): {
  decisionBox: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    opacity: number;
    boxShadow: string;
    animation: string;
  };
  actionButton: {
    backgroundColor: string;
    hoverColor: string;
    textColor: string;
    disabled: boolean;
  };
  statusIndicator: {
    color: string;
    icon: string;
    pulse: boolean;
  };
} {
  const color = VISUAL_COLORS[result.state.primaryColor];
  
  return {
    decisionBox: {
      backgroundColor: color.background,
      borderColor: color.border,
      textColor: color.primary,
      opacity: color.opacity,
      boxShadow: result.config.animations.glow ? `0 0 20px ${color.primary}40` : "none",
      animation: result.config.animations.pulse ? "pulse 2s infinite" : "none"
    },
    actionButton: {
      backgroundColor: color.primary,
      hoverColor: color.border,
      textColor: "#ffffff",
      disabled: result.state.primaryColor === "GRAY"
    },
    statusIndicator: {
      color: color.primary,
      icon: color.icon,
      pulse: result.config.animations.pulse
    }
  };
}
