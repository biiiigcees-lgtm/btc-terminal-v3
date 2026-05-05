// lib/signalThrottling.ts — Signal throttling to only update on meaningful changes

export interface SignalState {
  direction: "ABOVE" | "BELOW" | "WAIT";
  ev: number;
  probability: number;
  confidence: number;
  alphaScore: number;
  consensusStrength: number;
  regime: string;
  timestamp: number;
}

export interface ThrottleConfig {
  evThreshold: number;        // Minimum EV change to trigger update
  probabilityThreshold: number; // Minimum probability change to trigger update
  confidenceThreshold: number;  // Minimum confidence change to trigger update
  directionChangeRequired: boolean; // Always update on direction change
  regimeChangeRequired: boolean;   // Always update on regime change
  minUpdateInterval: number;   // Minimum seconds between updates
  maxUpdateInterval: number;   // Maximum seconds before forced update
}

export interface ThrottleResult {
  shouldUpdate: boolean;
  reason: string;
  changes: string[];
  severity: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
}

// Final God Tier Lock throttling configuration (SIGNAL COOLDOWN)
const DEFAULT_CONFIG: ThrottleConfig = {
  evThreshold: 0.01,           // 1% EV change
  probabilityThreshold: 5,    // 5% probability change
  confidenceThreshold: 8,     // 8% confidence change
  directionChangeRequired: true,
  regimeChangeRequired: true,
  minUpdateInterval: 15,       // 15 seconds minimum (SIGNAL COOLDOWN)
  maxUpdateInterval: 300,      // 5 minutes maximum
};

// In-memory store for last signal state
let lastSignalState: SignalState | null = null;
let lastUpdateTime: number = 0;

// Check if signal should be updated based on throttling rules
export function shouldUpdateSignal(
  currentSignal: SignalState,
  config: Partial<ThrottleConfig> = {}
): ThrottleResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  
  // Initialize if first signal
  if (!lastSignalState) {
    lastSignalState = { ...currentSignal };
    lastUpdateTime = now;
    return {
      shouldUpdate: true,
      reason: "First signal received",
      changes: ["Initial signal"],
      severity: "CRITICAL"
    };
  }
  
  // Check minimum update interval
  const timeSinceLastUpdate = (now - lastUpdateTime) / 1000;
  if (timeSinceLastUpdate < finalConfig.minUpdateInterval) {
    return {
      shouldUpdate: false,
      reason: `Too soon since last update (${timeSinceLastUpdate.toFixed(0)}s < ${finalConfig.minUpdateInterval}s)`,
      changes: [],
      severity: "MINOR"
    };
  }
  
  // Check maximum update interval (force update)
  if (timeSinceLastUpdate > finalConfig.maxUpdateInterval) {
    const changes = detectAllChanges(currentSignal, lastSignalState);
    updateSignalState(currentSignal, now);
    return {
      shouldUpdate: true,
      reason: `Maximum update interval exceeded (${timeSinceLastUpdate.toFixed(0)}s > ${finalConfig.maxUpdateInterval}s)`,
      changes,
      severity: "MODERATE"
    };
  }
  
  // Check for critical changes that always trigger updates
  const criticalChanges = checkCriticalChanges(currentSignal, lastSignalState, finalConfig);
  if (criticalChanges.length > 0) {
    updateSignalState(currentSignal, now);
    return {
      shouldUpdate: true,
      reason: "Critical change detected",
      changes: criticalChanges,
      severity: "CRITICAL"
    };
  }
  
  // Check for meaningful changes
  const meaningfulChanges = checkMeaningfulChanges(currentSignal, lastSignalState, finalConfig);
  if (meaningfulChanges.length > 0) {
    updateSignalState(currentSignal, now);
    return {
      shouldUpdate: true,
      reason: "Meaningful change detected",
      changes: meaningfulChanges,
      severity: "MODERATE"
    };
  }
  
  // Check for minor changes (may or may not update based on time)
  const minorChanges = checkMinorChanges(currentSignal, lastSignalState, finalConfig);
  if (minorChanges.length > 0 && timeSinceLastUpdate > 60) { // Only minor updates after 1 minute
    updateSignalState(currentSignal, now);
    return {
      shouldUpdate: true,
      reason: "Minor change detected after interval",
      changes: minorChanges,
      severity: "MINOR"
    };
  }
  
  return {
    shouldUpdate: false,
    reason: "No meaningful changes detected",
    changes: [],
    severity: "MINOR"
  };
}

// Check for critical changes that always trigger updates
function checkCriticalChanges(
  current: SignalState,
  last: SignalState,
  config: ThrottleConfig
): string[] {
  const changes: string[] = [];
  
  // Direction change (most critical)
  if (config.directionChangeRequired && current.direction !== last.direction) {
    changes.push(`Direction changed: ${last.direction} → ${current.direction}`);
  }
  
  // Regime change
  if (config.regimeChangeRequired && current.regime !== last.regime) {
    changes.push(`Regime changed: ${last.regime} → ${current.regime}`);
  }
  
  // Trade decision change (WAIT to trade or vice versa)
  const lastWasTrade = last.direction !== "WAIT";
  const currentIsTrade = current.direction !== "WAIT";
  if (lastWasTrade !== currentIsTrade) {
    changes.push(`Trade decision changed: ${lastWasTrade ? "TRADING" : "WAITING"} → ${currentIsTrade ? "TRADING" : "WAITING"}`);
  }
  
  // EV sign change (positive to negative or vice versa)
  if ((current.ev > 0) !== (last.ev > 0)) {
    changes.push(`EV sign changed: ${last.ev > 0 ? "POSITIVE" : "NEGATIVE"} → ${current.ev > 0 ? "POSITIVE" : "NEGATIVE"}`);
  }
  
  return changes;
}

// Check for meaningful changes
function checkMeaningfulChanges(
  current: SignalState,
  last: SignalState,
  config: ThrottleConfig
): string[] {
  const changes: string[] = [];
  
  // EV change beyond threshold
  const evChange = Math.abs(current.ev - last.ev);
  if (evChange >= config.evThreshold) {
    changes.push(`EV changed by ${evChange.toFixed(3)} (${last.ev.toFixed(3)} → ${current.ev.toFixed(3)})`);
  }
  
  // Probability change beyond threshold
  const probChange = Math.abs(current.probability - last.probability);
  if (probChange >= config.probabilityThreshold) {
    changes.push(`Probability changed by ${probChange.toFixed(1)}% (${last.probability.toFixed(1)}% → ${current.probability.toFixed(1)}%)`);
  }
  
  // Confidence change beyond threshold
  const confChange = Math.abs(current.confidence - last.confidence);
  if (confChange >= config.confidenceThreshold) {
    changes.push(`Confidence changed by ${confChange.toFixed(1)}% (${last.confidence.toFixed(1)}% → ${current.confidence.toFixed(1)}%)`);
  }
  
  // Consensus strength change beyond threshold
  const consensusChange = Math.abs(current.consensusStrength - last.consensusStrength);
  if (consensusChange >= 10) {
    changes.push(`Consensus strength changed by ${consensusChange.toFixed(0)}% (${last.consensusStrength.toFixed(0)}% → ${current.consensusStrength.toFixed(0)}%)`);
  }
  
  return changes;
}

// Check for minor changes
function checkMinorChanges(
  current: SignalState,
  last: SignalState,
  config: ThrottleConfig
): string[] {
  const changes: string[] = [];
  
  // Small EV changes
  const evChange = Math.abs(current.ev - last.ev);
  if (evChange > 0.001 && evChange < config.evThreshold) {
    changes.push(`Minor EV change: ${evChange.toFixed(3)}`);
  }
  
  // Small probability changes
  const probChange = Math.abs(current.probability - last.probability);
  if (probChange > 1 && probChange < config.probabilityThreshold) {
    changes.push(`Minor probability change: ${probChange.toFixed(1)}%`);
  }
  
  // Small confidence changes
  const confChange = Math.abs(current.confidence - last.confidence);
  if (confChange > 2 && confChange < config.confidenceThreshold) {
    changes.push(`Minor confidence change: ${confChange.toFixed(1)}%`);
  }
  
  return changes;
}

// Detect all changes for debugging
function detectAllChanges(current: SignalState, last: SignalState): string[] {
  const changes: string[] = [];
  
  if (current.direction !== last.direction) {
    changes.push(`Direction: ${last.direction} → ${current.direction}`);
  }
  
  if (Math.abs(current.ev - last.ev) > 0.001) {
    changes.push(`EV: ${last.ev.toFixed(3)} → ${current.ev.toFixed(3)}`);
  }
  
  if (Math.abs(current.probability - last.probability) > 0.5) {
    changes.push(`Probability: ${last.probability.toFixed(1)}% → ${current.probability.toFixed(1)}%`);
  }
  
  if (Math.abs(current.confidence - last.confidence) > 0.5) {
    changes.push(`Confidence: ${last.confidence.toFixed(1)}% → ${current.confidence.toFixed(1)}%`);
  }
  
  if (current.regime !== last.regime) {
    changes.push(`Regime: ${last.regime} → ${current.regime}`);
  }
  
  return changes;
}

// Update signal state
function updateSignalState(signal: SignalState, timestamp: number): void {
  lastSignalState = { ...signal };
  lastUpdateTime = timestamp;
}

// Get current signal state
export function getCurrentSignalState(): SignalState | null {
  return lastSignalState ? { ...lastSignalState } : null;
}

// Reset throttling state
export function resetThrottling(): void {
  lastSignalState = null;
  lastUpdateTime = 0;
}

// Get throttling statistics
export function getThrottlingStats(): {
  lastUpdateTime: number;
  timeSinceLastUpdate: number;
  hasState: boolean;
  currentDirection: string | null;
  currentEV: number | null;
} {
  const now = Date.now();
  const timeSinceLastUpdate = lastUpdateTime > 0 ? (now - lastUpdateTime) / 1000 : 0;
  
  return {
    lastUpdateTime,
    timeSinceLastUpdate,
    hasState: lastSignalState !== null,
    currentDirection: lastSignalState?.direction || null,
    currentEV: lastSignalState?.ev || null
  };
}

// Force update (bypass throttling)
export function forceUpdate(signal: SignalState): void {
  updateSignalState(signal, Date.now());
}

// Check if signal is stale (no updates for too long)
export function isSignalStale(maxAgeSeconds: number = 600): boolean {
  if (!lastSignalState) return true;
  
  const now = Date.now();
  const age = (now - lastUpdateTime) / 1000;
  
  return age > maxAgeSeconds;
}

// Get signal age in seconds
export function getSignalAge(): number {
  if (!lastSignalState) return Infinity;
  
  const now = Date.now();
  return (now - lastUpdateTime) / 1000;
}
