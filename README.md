# BTC Terminal v3 — God-Tier Kalshi Signal Engine

## What's New in v3

### Signal Intelligence
- **13 Technical Indicators**: EMA, RSI, MACD, BB, Stochastics, VWAP, ATR, Momentum, Williams %R (NEW), CCI (NEW), CMF (NEW), CVD, Order Flow
- **Multi-Timeframe Filter**: 1H + 4H EMA bias must align with 15M signal
- **Alpha Threshold 70+**: Only BET tier (70+) and HIGH_CONVICTION (80+) trigger betting

### Risk Management
- **ATR Volatility Gate**: Auto-disables betting when volatility spikes 1.5x above average
- **Time-of-Day Filter**: Best windows flagged (NY Open, London Open, US Evening UTC)
- **Confidence Tier Badge**: DO_NOT_BET / MARGINAL / BET / HIGH_CONVICTION
- **Daily Loss Lock**: 3 consecutive losses = 30-min cooldown (hard)
- **Win Streak Warning**: 3+ consecutive wins = reduce bet size alert

### Session Tracking
- **Session P&L Tracker**: Real-time bets / wins / losses / net PnL / win rate
- **Hourly Heatmap**: Color-coded win rate by UTC hour — find your best windows
- **Trade Log**: Full history with alpha, tier, result, P&L
- **Bet Execution**: Log bets + mark WIN/LOSS to track results

### Bug Fixes
- Fixed template literal rendering bug in direction display
- Proper TypeScript types throughout

---

## Setup

```bash
# 1. Open this folder in VS Code
cd btc-terminal-v3

# 2. Install dependencies
npm install

# 3. Run locally
npm run dev

# 4. Open http://localhost:3000
```

## Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel --prod
```

---

## When to Bet (The Rules)

Only bet when ALL of these are true:
1. **Alpha Score ≥ 70** (🟢 BET tier or higher)
2. **ATR Gate = OPEN** (not volatile)
3. **Time Window = GOOD** (NY/London/US Evening)
4. **HTF Aligned** (1H + 4H agree with 15M signal)
5. **NOT locked** (no 3-loss streak active)

Skip if even ONE gate fails.

---

## Architecture

```
app/
  page.tsx              — Main shell, data polling every 15s
  api/
    market/route.ts     — Binance + Coinbase + Kraken + CoinGecko
    signal/route.ts     — Full signal computation
components/
  Sidebar.tsx           — Nav + quick stats + bankroll
  TopBar.tsx            — Live price feed + exchange spread
  PlannerTab.tsx        — GOD TIER — main betting UI
  OverviewTab.tsx       — Market snapshot
  KalshiTab.tsx         — Probability edge display
  ConsensusTab.tsx      — All indicators pass/fail
  LogsTab.tsx           — Trade history
  AlertsTab.tsx         — Live alerts
  LockOverlay.tsx       — 30-min cooldown screen
lib/
  indicators.ts         — All 13 indicators
  scoring.ts            — Alpha engine + Kelly + gates
store/
  terminal.ts           — Zustand state (persisted)
types/
  index.ts              — Shared TypeScript types
```
