"use client";
// components/OrderBook.tsx — Live Binance bid/ask depth display

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function OrderBook() {
  const { orderBook } = useTerminal();

  if (!orderBook) {
    return (
      <div className="bg-panel border border-border rounded-xl p-4">
        <div className="text-dim text-xs font-mono uppercase mb-2">Order Book Depth</div>
        <div className="text-dim text-xs font-mono animate-pulse">Loading order book...</div>
      </div>
    );
  }

  const imb = orderBook.imbalance;
  const imbPct = Math.round(Math.abs(imb) * 100);
  const imbDir = imb > 0.05 ? "BUY PRESSURE" : imb < -0.05 ? "SELL PRESSURE" : "BALANCED";
  const imbColor = imb > 0.05 ? "text-green" : imb < -0.05 ? "text-red" : "text-amber";

  const maxQty = Math.max(
    ...orderBook.bids.map(b => b.qty),
    ...orderBook.asks.map(a => a.qty)
  );

  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-dim text-xs font-mono uppercase tracking-widest">Live Order Book</span>
        <div className="flex items-center gap-2">
          <span className={clsx("text-xs font-mono font-bold", imbColor)}>{imbDir}</span>
          <span className="text-dim text-[10px] font-mono">Imb: {imb >= 0 ? "+" : ""}{imb.toFixed(3)}</span>
        </div>
      </div>

      {/* Imbalance bar */}
      <div className="h-2 bg-surface rounded-full overflow-hidden mb-3 flex">
        <div
          className="h-full bg-green transition-all duration-300"
          style={{ width: `${50 + imb * 50}%` }}
        />
        <div className="h-full flex-1 bg-red" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Asks (sells) */}
        <div>
          <div className="text-red text-[10px] font-mono uppercase mb-1.5">Asks (Sell)</div>
          <div className="space-y-0.5">
            {orderBook.asks.slice(0, 8).reverse().map((ask, i) => (
              <div key={i} className="relative flex justify-between text-[10px] font-mono px-1.5 py-0.5">
                <div
                  className="absolute inset-0 bg-red/10 rounded"
                  style={{ width: `${(ask.qty / maxQty) * 100}%` }}
                />
                <span className="text-red relative z-10">${ask.price.toLocaleString()}</span>
                <span className="text-dim relative z-10">{ask.qty.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bids (buys) */}
        <div>
          <div className="text-green text-[10px] font-mono uppercase mb-1.5">Bids (Buy)</div>
          <div className="space-y-0.5">
            {orderBook.bids.slice(0, 8).map((bid, i) => (
              <div key={i} className="relative flex justify-between text-[10px] font-mono px-1.5 py-0.5">
                <div
                  className="absolute inset-0 bg-green/10 rounded"
                  style={{ width: `${(bid.qty / maxQty) * 100}%` }}
                />
                <span className="text-green relative z-10">${bid.price.toLocaleString()}</span>
                <span className="text-dim relative z-10">{bid.qty.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] font-mono text-dim">
        <span>Spread: <span className="text-text">${orderBook.spread.toFixed(2)}</span></span>
        <span className="text-right">Updated: {new Date(orderBook.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
