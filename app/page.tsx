"use client";
// app/page.tsx — BTC Terminal v3 main shell

import { useEffect, useCallback, useRef } from "react";
import { useTerminal } from "@/store/terminal";
import { useAlphaStream } from "@/lib/useAlphaStream";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { DashboardTab } from "@/components/DashboardTab";
import { PlannerTab } from "@/components/PlannerTab";
import { OverviewTab } from "@/components/OverviewTab";
import { LogsTab } from "@/components/LogsTab";
import { AlertsTab } from "@/components/AlertsTab";
import { KalshiTab } from "@/components/KalshiTab";
import { ConsensusTab } from "@/components/ConsensusTab";
import { BacktestTab } from "@/components/BacktestTab";
import { AccuracyTab } from "@/components/AccuracyTab";
import { PnLTrackerTab } from "@/components/PnLTrackerTab";
import { ExecutionPanel } from "@/components/ExecutionPanel";
import { LockOverlay } from "@/components/LockOverlay";

export default function TerminalPage() {
  const {
    setMarket, setSignal, setLoading, setOrderBook,
    setKalshiMarkets, resolveAccuracyEntries,
    activeTab, session, checkAndApplyLossLock, market,
  } = useTerminal();

  // Execution engine — triggers on every new signal when autoMode is on
  useAlphaStream();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const obIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track latest price in a ref so the interval closure stays stable
  const marketPriceRef = useRef<number | null>(null);
  marketPriceRef.current = market?.price ?? null;

  // Main data fetch — market + signal every 15s
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [mRes, sRes] = await Promise.all([
        fetch("/api/market", { cache: "no-store" }),
        fetch("/api/signal", { cache: "no-store" }),
      ]);
      if (mRes.ok) setMarket(await mRes.json());
      if (sRes.ok) setSignal(await sRes.json());
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [setMarket, setSignal, setLoading]);

  // Order book — every 5s
  const fetchOrderBook = useCallback(async () => {
    try {
      const res = await fetch("/api/orderbook", { cache: "no-store" });
      if (res.ok) setOrderBook(await res.json());
    } catch {}
  }, [setOrderBook]);

  // Kalshi markets — every 30s
  const fetchKalshi = useCallback(async () => {
    try {
      const res = await fetch("/api/kalshi", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setKalshiMarkets(data.markets ?? [], data.fallback ?? true);
      }
    } catch {}
  }, [setKalshiMarkets]);

  useEffect(() => {
    fetchAll();
    fetchOrderBook();
    fetchKalshi();

    intervalRef.current = setInterval(() => {
      fetchAll();
      checkAndApplyLossLock();
      fetchKalshi();
      if (marketPriceRef.current) resolveAccuracyEntries(marketPriceRef.current);
    }, 15000);

    obIntervalRef.current = setInterval(fetchOrderBook, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (obIntervalRef.current) clearInterval(obIntervalRef.current);
    };
  }, [fetchAll, fetchOrderBook, fetchKalshi, checkAndApplyLossLock, resolveAccuracyEntries]);

  const tabMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardTab />,
    overview: <OverviewTab />,
    kalshi: <KalshiTab />,
    consensus: <ConsensusTab />,
    planner: <PlannerTab />,
    logs: <LogsTab />,
    alerts: <AlertsTab />,
    backtest: <BacktestTab />,
    accuracy: <AccuracyTab />,
    pnltracker: <PnLTrackerTab />,
    execution: <ExecutionPanel />,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden relative">
          {session.isLocked && <LockOverlay />}
          <div className="h-full overflow-y-auto p-4">
            {tabMap[activeTab] ?? <DashboardTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
