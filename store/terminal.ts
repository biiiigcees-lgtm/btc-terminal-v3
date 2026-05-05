// store/terminal.ts — Full upgraded state for BTC Terminal v3

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  TradeLog, SessionStats, MarketData, SignalResult,
  OrderBookSnapshot, BacktestResult, SignalAccuracyEntry, GroqSignalComment,
  AgentWeights, WeightOptimizationResult,
} from "@/types";
import { createAccuracyEntry, resolveAccuracyEntry, calcAccuracyStats } from "@/lib/signalTracker";
import { optimizeWeights, computeSimulatedPnLStats, BASE_WEIGHTS } from "@/lib/weightOptimizer";
import type { StrategyMode } from "@/lib/strategyConfig";
import { modeToThreshold } from "@/lib/strategyConfig";

const SESSION_ID = () => `ses_${Date.now()}`;

const defaultSession = (): SessionStats => ({
  sessionId: SESSION_ID(),
  startTime: Date.now(),
  betsToday: 0,
  wins: 0,
  losses: 0,
  pending: 0,
  netPnl: 0,
  winRate: 0,
  bankroll: 25,
  peakBankroll: 25,
  consecutiveLosses: 0,
  consecutiveWins: 0,
  isLocked: false,
  lockUntil: null,
  lockReason: null,
  hourlyStats: {},
});

interface TerminalStore {
  market: MarketData | null;
  signal: SignalResult | null;
  isLoading: boolean;
  lastUpdated: number;
  dataStale: boolean;
  setMarket: (m: MarketData) => void;
  setSignal: (s: SignalResult) => void;
  setLoading: (v: boolean) => void;

  activeTab: "overview" | "kalshi" | "consensus" | "planner" | "logs" | "alerts" | "backtest" | "accuracy" | "pnltracker";
  setTab: (t: TerminalStore["activeTab"]) => void;

  orderBook: OrderBookSnapshot | null;
  setOrderBook: (ob: OrderBookSnapshot) => void;

  session: SessionStats;
  setBankroll: (amount: number) => void;
  resetSession: () => void;

  logs: TradeLog[];
  logTrade: (log: Omit<TradeLog, "id" | "sessionId">) => void;
  resolveTrade: (id: string, result: "WIN" | "LOSS", pnl: number) => void;
  clearLogs: () => void;

  checkAndApplyLossLock: () => void;
  unlockManual: () => void;

  getDrawdownStats: () => { currentDrawdown: number; maxDrawdown: number; drawdownPct: number; peakBankroll: number; warningLevel: "NONE" | "CAUTION" | "WARNING" | "DANGER" };

  accuracyLog: SignalAccuracyEntry[];
  addAccuracyEntry: (direction: SignalResult["direction"], alpha: number, tier: string, price: number) => void;
  resolveAccuracyEntries: (currentPrice: number) => void;
  getAccuracyStats: () => ReturnType<typeof calcAccuracyStats>;
  clearAccuracyLog: () => void;

  backtestResult: BacktestResult | null;
  backtestLoading: boolean;
  backtestError: string | null;
  setBacktestResult: (r: BacktestResult) => void;
  setBacktestLoading: (v: boolean) => void;
  setBacktestError: (e: string | null) => void;

  groqComment: GroqSignalComment | null;
  groqLoading: boolean;
  setGroqComment: (c: GroqSignalComment) => void;
  setGroqLoading: (v: boolean) => void;
  fetchGroqComment: () => Promise<void>;

  kalshiMarkets: { ticker: string; title: string; yesPrice: number; noPrice: number; impliedProb: number; volume: number; expiresAt: string }[];
  kalshiFallback: boolean;
  setKalshiMarkets: (markets: TerminalStore["kalshiMarkets"], fallback: boolean) => void;

  userDirection: "UP" | "DOWN" | null;
  setUserDirection: (d: "UP" | "DOWN" | null) => void;
  aiAuto: boolean;
  setAiAuto: (v: boolean) => void;

  // ── Strategy & Edge Threshold ───────────────────────────────────────────
  strategyMode: StrategyMode;
  setStrategyMode: (m: StrategyMode) => void;
  edgeThreshold: number; // 0-100 slider
  setEdgeThreshold: (v: number) => void;

  // ── Custom Weights (from optimizer) ────────────────────────────────────
  customWeights: AgentWeights | null;
  setCustomWeights: (w: AgentWeights | null) => void;
  getWeightOptimization: () => WeightOptimizationResult;

  // ── Simulated PnL Stats (derived from accuracyLog) ─────────────────────
  getSimulatedPnLStats: () => ReturnType<typeof computeSimulatedPnLStats>;
}

export const useTerminal = create<TerminalStore>()(
  persist(
    (set, get) => ({
      market: null,
      signal: null,
      isLoading: false,
      lastUpdated: 0,
      dataStale: false,
      setMarket: (m) => set({ market: m, lastUpdated: Date.now(), dataStale: false }),
      setSignal: (s) => {
        const prev = get().signal;
        set({ signal: s });
        if (s.direction !== "WAIT" && s.alphaScore >= 60) {
          get().addAccuracyEntry(s.direction, s.alphaScore, s.confidenceTier, s.priceEntry);
        }
        if (s.alphaScore >= 70 && s.confidenceTier !== prev?.confidenceTier) {
          get().fetchGroqComment();
        }
      },
      setLoading: (v) => {
        set({ isLoading: v });
        // Mark data stale if loading hasn't resolved in 90s
        if (!v) return;
        setTimeout(() => {
          const { lastUpdated } = get();
          if (Date.now() - lastUpdated > 90000) set({ dataStale: true });
        }, 90000);
      },

      activeTab: "planner",
      setTab: (t) => set({ activeTab: t }),

      orderBook: null,
      setOrderBook: (ob) => set({ orderBook: ob }),

      session: defaultSession(),
      setBankroll: (amount) =>
        set((s) => ({
          session: { ...s.session, bankroll: amount, peakBankroll: Math.max(amount, s.session.peakBankroll) },
        })),
      resetSession: () => set({ session: defaultSession(), logs: [] }),

      logs: [],
      logTrade: (log) => {
        const newLog: TradeLog = { ...log, id: `t_${Date.now()}`, sessionId: get().session.sessionId };
        set((s) => {
          const session = { ...s.session, betsToday: s.session.betsToday + 1, pending: s.session.pending + 1 };
          const hour = new Date().getUTCHours();
          const prev = session.hourlyStats[hour] ?? { wins: 0, losses: 0, bets: 0 };
          session.hourlyStats = { ...session.hourlyStats, [hour]: { ...prev, bets: prev.bets + 1 } };
          return { logs: [newLog, ...s.logs].slice(0, 500), session };
        });
      },
      resolveTrade: (id, result, pnl) => {
        set((s) => {
          const logs = s.logs.map((l) => l.id === id ? { ...l, result, pnl } : l);
          const session = { ...s.session };
          session.pending = Math.max(0, session.pending - 1);
          session.netPnl = parseFloat((session.netPnl + pnl).toFixed(2));
          if (result === "WIN") {
            session.wins++;
            session.consecutiveWins++;
            session.consecutiveLosses = 0;
            session.bankroll = parseFloat((session.bankroll + Math.abs(pnl)).toFixed(2));
            session.peakBankroll = Math.max(session.bankroll, session.peakBankroll);
          } else {
            session.losses++;
            session.consecutiveLosses++;
            session.consecutiveWins = 0;
            session.bankroll = parseFloat((session.bankroll - Math.abs(pnl)).toFixed(2));
          }
          const total = session.wins + session.losses;
          session.winRate = total > 0 ? Math.round((session.wins / total) * 100) : 0;
          const hour = new Date().getUTCHours();
          const prev = session.hourlyStats[hour] ?? { wins: 0, losses: 0, bets: 0 };
          session.hourlyStats = {
            ...session.hourlyStats,
            [hour]: {
              ...prev,
              wins: result === "WIN" ? prev.wins + 1 : prev.wins,
              losses: result === "LOSS" ? prev.losses + 1 : prev.losses,
            },
          };
          return { logs, session };
        });
        get().checkAndApplyLossLock();
      },
      clearLogs: () => set({ logs: [] }),

      checkAndApplyLossLock: () => {
        const { session } = get();
        if (session.consecutiveLosses >= 3 && !session.isLocked) {
          set((s) => ({
            session: { ...s.session, isLocked: true, lockUntil: Date.now() + 30 * 60 * 1000, lockReason: "3 consecutive losses — 30-min cooldown" },
          }));
        }
        if (session.isLocked && session.lockUntil && Date.now() >= session.lockUntil) {
          set((s) => ({
            session: { ...s.session, isLocked: false, lockUntil: null, lockReason: null, consecutiveLosses: 0 },
          }));
        }
      },
      unlockManual: () =>
        set((s) => ({
          session: { ...s.session, isLocked: false, lockUntil: null, lockReason: null, consecutiveLosses: 0 },
        })),

      getDrawdownStats: () => {
        const { session } = get();
        const currentDrawdown = session.peakBankroll - session.bankroll;
        const drawdownPct = session.peakBankroll > 0 ? Math.round((currentDrawdown / session.peakBankroll) * 100) : 0;
        const warningLevel = drawdownPct >= 40 ? "DANGER" : drawdownPct >= 25 ? "WARNING" : drawdownPct >= 15 ? "CAUTION" : "NONE";
        return { currentDrawdown, maxDrawdown: currentDrawdown, drawdownPct, peakBankroll: session.peakBankroll, warningLevel };
      },

      accuracyLog: [],
      addAccuracyEntry: (direction, alpha, tier, price) => {
        if (direction === "WAIT") return;
        const entry = createAccuracyEntry(direction, alpha, tier, price);
        set((s) => ({ accuracyLog: [entry, ...s.accuracyLog].slice(0, 200) }));
      },
      resolveAccuracyEntries: (currentPrice) => {
        const FIFTEEN_MIN = 15 * 60 * 1000;
        set((s) => ({
          accuracyLog: s.accuracyLog.map((e) => {
            if (e.resolved) return e;
            if (Date.now() - e.timestamp >= FIFTEEN_MIN) return resolveAccuracyEntry(e, currentPrice);
            return e;
          }),
        }));
      },
      getAccuracyStats: () => calcAccuracyStats(get().accuracyLog),
      clearAccuracyLog: () => set({ accuracyLog: [] }),

      backtestResult: null,
      backtestLoading: false,
      backtestError: null,
      setBacktestResult: (r) => set({ backtestResult: r, backtestLoading: false, backtestError: null }),
      setBacktestLoading: (v) => set({ backtestLoading: v }),
      setBacktestError: (e) => set({ backtestError: e, backtestLoading: false }),

      groqComment: null,
      groqLoading: false,
      setGroqComment: (c) => set({ groqComment: c, groqLoading: false }),
      setGroqLoading: (v) => set({ groqLoading: v }),
      fetchGroqComment: async () => {
        const { signal, market } = get();
        if (!signal || !market) return;
        set({ groqLoading: true });
        try {
          const res = await fetch("/api/groq", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signal, indicators: signal.indicators, price: market.price }),
          });
          if (res.ok) set({ groqComment: await res.json(), groqLoading: false });
          else set({ groqLoading: false });
        } catch { set({ groqLoading: false }); }
      },

      kalshiMarkets: [],
      kalshiFallback: true,
      setKalshiMarkets: (markets, fallback) => set({ kalshiMarkets: markets, kalshiFallback: fallback }),

      userDirection: null,
      setUserDirection: (d) => set({ userDirection: d }),
      aiAuto: true,
      setAiAuto: (v) => set({ aiAuto: v }),

      strategyMode: "BALANCED",
      setStrategyMode: (m) => set({ strategyMode: m, edgeThreshold: modeToThreshold(m) }),
      edgeThreshold: 50,
      setEdgeThreshold: (v) => set({ edgeThreshold: v }),

      customWeights: null,
      setCustomWeights: (w) => set({ customWeights: w }),
      getWeightOptimization: () => optimizeWeights(get().accuracyLog),

      getSimulatedPnLStats: () => computeSimulatedPnLStats(get().accuracyLog),
    }),
    {
      name: "btc-terminal-v3",
      partialize: (s) => ({
        logs: s.logs,
        session: s.session,
        accuracyLog: s.accuracyLog,
        strategyMode: s.strategyMode,
        edgeThreshold: s.edgeThreshold,
        customWeights: s.customWeights,
      }),
    }
  )
);
