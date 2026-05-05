"use client";
// components/TopBar.tsx

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function TopBar() {
  const { market, isLoading, lastUpdated } = useTerminal();
  const price = market?.price ?? 0;
  const change = market?.change24h ?? 0;
  const isUp = change >= 0;
  const time = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--:--:--";

  return (
    <header className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
      {/* Price */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-accent font-mono font-bold text-lg">
            ${fmt(price)}
          </span>
          <span className={clsx("text-sm font-mono font-semibold px-1.5 py-0.5 rounded",
            isUp ? "bg-green/10 text-green" : "bg-red/10 text-red"
          )}>
            {isUp ? "+" : ""}{change.toFixed(2)}%
          </span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-dim">
          <span>H: <span className="text-text">${fmt(market?.high24h ?? 0)}</span></span>
          <span>L: <span className="text-text">${fmt(market?.low24h ?? 0)}</span></span>
          <span>VOL: <span className="text-text">${fmt((market?.volume24h ?? 0) / 1e9, 2)}B</span></span>
          <span>MCAP: <span className="text-text">${fmt((market?.marketCap ?? 0) / 1e9, 1)}B</span></span>
        </div>
      </div>

      {/* Feed status */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-dim">
        <span>BINANCE <span className="text-text">${fmt(market?.binance ?? 0)}</span></span>
        <span>COINBASE <span className="text-text">${fmt(market?.coinbase ?? 0)}</span></span>
        <span>KRAKEN <span className="text-text">${fmt(market?.kraken ?? 0)}</span></span>
        <span className="hidden md:inline">AGG <span className="text-accent font-bold">${fmt(market?.agg ?? 0)}</span></span>
        <div className="flex items-center gap-1.5">
          <div className={clsx("pulse-dot", isLoading ? "bg-amber" : "bg-green")} />
          <span className={isLoading ? "text-amber" : "text-green"}>
            {isLoading ? "UPDATING" : `LIVE ${time}`}
          </span>
        </div>
      </div>
    </header>
  );
}
