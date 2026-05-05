// lib/database.ts — Database schema and connection management

export interface DatabaseConfig {
  type: "sqlite" | "postgres" | "mysql";
  connectionString?: string;
  filename?: string; // For SQLite
}

// Database tables schema
export const SIGNALS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  price REAL NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('ABOVE', 'BELOW', 'WAIT')),
  
  -- Alpha score components
  alpha_score INTEGER NOT NULL CHECK (alpha_score >= 0 AND alpha_score <= 100),
  alpha_confidence INTEGER NOT NULL CHECK (alpha_confidence >= 0 AND alpha_confidence <= 100),
  alpha_direction TEXT NOT NULL CHECK (alpha_direction IN ('ABOVE', 'BELOW', 'WAIT')),
  regime TEXT NOT NULL,
  regime_strength INTEGER NOT NULL CHECK (regime_strength >= 0 AND regime_strength <= 100),
  
  -- Consensus components
  consensus_direction TEXT NOT NULL CHECK (consensus_direction IN ('ABOVE', 'BELOW', 'NEUTRAL')),
  consensus_strength INTEGER NOT NULL CHECK (consensus_strength >= 0 AND consensus_strength <= 100),
  consensus_agreement INTEGER NOT NULL CHECK (consensus_agreement >= 0 AND consensus_agreement <= 100),
  consensus_confidence INTEGER NOT NULL CHECK (consensus_confidence >= 0 AND consensus_confidence <= 100),
  
  -- Agent votes (JSON)
  agent_votes TEXT NOT NULL, -- JSON string of agent votes
  
  -- EV components
  ev REAL NOT NULL,
  risk_adjusted_ev REAL NOT NULL,
  probability INTEGER NOT NULL CHECK (probability >= 0 AND probability <= 100),
  risk_reward REAL NOT NULL,
  kelly_fraction REAL NOT NULL,
  position_size REAL NOT NULL,
  
  -- Trade execution
  trade_executed BOOLEAN NOT NULL DEFAULT FALSE,
  trade_type TEXT CHECK (trade_type IN ('KALSHI', 'SPOT')),
  entry_price REAL,
  target_price REAL,
  stop_loss REAL,
  time_horizon INTEGER,
  
  -- Outcome (filled later)
  outcome TEXT CHECK (outcome IN ('WIN', 'LOSS', 'PENDING', 'CANCELLED')) DEFAULT 'PENDING',
  exit_price REAL,
  profit_loss REAL,
  exit_time INTEGER,
  hold_duration INTEGER, -- minutes
  
  -- Market context
  volatility REAL NOT NULL,
  volume REAL NOT NULL,
  rsi REAL NOT NULL,
  atr REAL NOT NULL,
  
  -- Performance tracking
  was_correct BOOLEAN,
  confidence_accuracy REAL,
  ev_accuracy REAL,
  
  -- Metadata
  session_id TEXT NOT NULL,
  signals TEXT NOT NULL, -- JSON array of signals
  warnings TEXT, -- JSON array of warnings
  quality TEXT CHECK (quality IN ('EXCELLENT', 'GOOD', 'FAIR', 'POOR')),
  
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_outcome ON signals(outcome);
CREATE INDEX IF NOT EXISTS idx_signals_direction ON signals(direction);
CREATE INDEX IF NOT EXISTS idx_signals_session ON signals(session_id);
CREATE INDEX IF NOT EXISTS idx_signals_trade_executed ON signals(trade_executed);
`;

export const AGENT_WEIGHTS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS agent_weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Agent weights
  momentum_weight REAL NOT NULL CHECK (momentum_weight > 0),
  volatility_weight REAL NOT NULL CHECK (volatility_weight > 0),
  mean_reversion_weight REAL NOT NULL CHECK (mean_reversion_weight > 0),
  order_flow_weight REAL NOT NULL CHECK (order_flow_weight > 0),
  kalshi_weight REAL NOT NULL CHECK (kalshi_weight > 0),
  
  -- Metadata
  total_trades INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  session_id TEXT NOT NULL,
  
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_weights_session ON agent_weights(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_weights_updated ON agent_weights(last_updated);
`;

export const PERFORMANCE_STATS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS performance_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Time period
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  
  -- Basic stats
  total_signals INTEGER NOT NULL DEFAULT 0,
  executed_trades INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  
  -- Performance metrics
  win_rate REAL NOT NULL DEFAULT 0,
  avg_profit REAL NOT NULL DEFAULT 0,
  avg_loss REAL NOT NULL DEFAULT 0,
  total_pnl REAL NOT NULL DEFAULT 0,
  sharpe_ratio REAL NOT NULL DEFAULT 0,
  max_drawdown REAL NOT NULL DEFAULT 0,
  avg_hold_duration REAL NOT NULL DEFAULT 0,
  
  -- Directional performance (JSON)
  accuracy_by_direction TEXT, -- JSON object
  
  -- Regime performance (JSON)
  accuracy_by_regime TEXT, -- JSON object
  
  -- Agent performance (JSON)
  performance_by_agent TEXT, -- JSON object
  
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_performance_stats_period ON performance_stats(period);
CREATE INDEX IF NOT EXISTS idx_performance_stats_start ON performance_stats(period_start);
`;

export const TRADE_EXECUTIONS_TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS trade_executions (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  
  -- Trade details
  trade_type TEXT NOT NULL CHECK (trade_type IN ('KALSHI', 'SPOT')),
  direction TEXT NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
  entry_price REAL NOT NULL,
  target_price REAL NOT NULL,
  stop_loss REAL NOT NULL,
  position_size REAL NOT NULL,
  
  -- Execution details
  entry_time INTEGER NOT NULL,
  exit_time INTEGER,
  exit_price REAL,
  outcome TEXT CHECK (outcome IN ('WIN', 'LOSS', 'CANCELLED', 'PENDING')) DEFAULT 'PENDING',
  profit_loss REAL,
  hold_duration INTEGER, -- minutes
  
  -- Fees and costs
  entry_fee REAL DEFAULT 0,
  exit_fee REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  
  -- Market context at execution
  market_price REAL NOT NULL,
  volatility REAL NOT NULL,
  volume REAL NOT NULL,
  
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_executions_signal ON trade_executions(signal_id);
CREATE INDEX IF NOT EXISTS idx_trade_executions_outcome ON trade_executions(outcome);
CREATE INDEX IF NOT EXISTS idx_trade_executions_entry_time ON trade_executions(entry_time);
`;

// Database connection class
export class DatabaseConnection {
  private config: DatabaseConfig;
  private db: any = null; // Would be actual DB connection
  
  constructor(config: DatabaseConfig) {
    this.config = config;
  }
  
  async connect(): Promise<void> {
    // In production, this would establish actual database connection
    // For now, we'll simulate connection
    console.log(`Connecting to ${this.config.type} database...`);
    
    if (this.config.type === "sqlite") {
      // Would use better-sqlite3 or similar
      console.log(`SQLite database: ${this.config.filename || ":memory:"}`);
    } else if (this.config.type === "postgres") {
      // Would use pg or similar
      console.log(`PostgreSQL connection: ${this.config.connectionString}`);
    }
    
    // Simulate successful connection
    this.db = { connected: true };
  }
  
  async initialize(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    
    // Create tables
    await this.execute(SIGNALS_TABLE_SCHEMA);
    await this.execute(AGENT_WEIGHTS_TABLE_SCHEMA);
    await this.execute(PERFORMANCE_STATS_TABLE_SCHEMA);
    await this.execute(TRADE_EXECUTIONS_TABLE_SCHEMA);
    
    console.log("Database initialized successfully");
  }
  
  async execute(sql: string, params?: any[]): Promise<any> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    
    // In production, this would execute actual SQL
    console.log(`Executing SQL: ${sql.substring(0, 100)}...`);
    return { success: true };
  }
  
  async query(sql: string, params?: any[]): Promise<any[]> {
    if (!this.db) {
      throw new Error("Database not connected");
    }
    
    // In production, this would execute actual query
    console.log(`Querying SQL: ${sql.substring(0, 100)}...`);
    return [];
  }
  
  async close(): Promise<void> {
    if (this.db) {
      console.log("Closing database connection...");
      this.db = null;
    }
  }
  
  // Signal operations
  async insertSignal(signal: any): Promise<void> {
    const sql = `
      INSERT INTO signals (
        id, timestamp, price, direction,
        alpha_score, alpha_confidence, alpha_direction, regime, regime_strength,
        consensus_direction, consensus_strength, consensus_agreement, consensus_confidence,
        agent_votes, ev, risk_adjusted_ev, probability, risk_reward, kelly_fraction, position_size,
        trade_executed, trade_type, entry_price, target_price, stop_loss, time_horizon,
        volatility, volume, rsi, atr,
        session_id, signals, warnings, quality
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(sql, [
      signal.id,
      signal.timestamp,
      signal.price,
      signal.direction,
      signal.alphaScore,
      signal.alphaConfidence,
      signal.alphaDirection,
      signal.regime,
      signal.regimeStrength,
      signal.consensusDirection,
      signal.consensusStrength,
      signal.consensusAgreement,
      signal.consensusConfidence,
      JSON.stringify(signal.agentVotes),
      signal.ev,
      signal.riskAdjustedEV,
      signal.probability,
      signal.riskReward,
      signal.kellyFraction,
      signal.positionSize,
      signal.tradeExecuted,
      signal.tradeType,
      signal.entryPrice,
      signal.targetPrice,
      signal.stopLoss,
      signal.timeHorizon,
      signal.volatility,
      signal.volume,
      signal.rsi,
      signal.atr,
      signal.sessionId,
      JSON.stringify(signal.signals),
      JSON.stringify(signal.warnings),
      signal.quality
    ]);
  }
  
  async updateSignalOutcome(id: string, outcome: string, exitPrice: number | null, profitLoss: number | null): Promise<void> {
    const sql = `
      UPDATE signals 
      SET outcome = ?, exit_price = ?, profit_loss = ?, exit_time = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `;
    
    await this.execute(sql, [outcome, exitPrice, profitLoss, Date.now(), id]);
  }
  
  async getSignals(limit: number = 100, sessionId?: string, outcome?: string): Promise<any[]> {
    let sql = "SELECT * FROM signals";
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (sessionId) {
      conditions.push("session_id = ?");
      params.push(sessionId);
    }
    
    if (outcome) {
      conditions.push("outcome = ?");
      params.push(outcome);
    }
    
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    
    sql += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);
    
    return await this.query(sql, params);
  }
  
  // Agent weights operations
  async upsertAgentWeights(weights: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO agent_weights (
        momentum_weight, volatility_weight, mean_reversion_weight, order_flow_weight, kalshi_weight,
        total_trades, last_updated, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(sql, [
      weights.momentum,
      weights.volatility,
      weights.meanReversion,
      weights.orderFlow,
      weights.kalshi,
      weights.totalTrades,
      weights.lastUpdated,
      "default" // sessionId
    ]);
  }
  
  async getAgentWeights(): Promise<any> {
    const sql = "SELECT * FROM agent_weights ORDER BY last_updated DESC LIMIT 1";
    const results = await this.query(sql);
    return results[0] || null;
  }
  
  // Performance stats operations
  async updatePerformanceStats(period: string, stats: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO performance_stats (
        period, period_start, period_end,
        total_signals, executed_trades, wins, losses, pending,
        win_rate, avg_profit, avg_loss, total_pnl, sharpe_ratio, max_drawdown, avg_hold_duration,
        accuracy_by_direction, accuracy_by_regime, performance_by_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(sql, [
      period,
      stats.periodStart || 0,
      stats.periodEnd || 0,
      stats.totalSignals,
      stats.executedTrades,
      stats.wins,
      stats.losses,
      stats.pending,
      stats.winRate,
      stats.avgProfit,
      stats.avgLoss,
      stats.totalPnL,
      stats.sharpeRatio,
      stats.maxDrawdown,
      stats.avgHoldDuration,
      JSON.stringify(stats.accuracyByDirection),
      JSON.stringify(stats.accuracyByRegime),
      JSON.stringify(stats.performanceByAgent)
    ]);
  }
  
  async getPerformanceStats(period?: string): Promise<any[]> {
    let sql = "SELECT * FROM performance_stats";
    const params: any[] = [];
    
    if (period) {
      sql += " WHERE period = ?";
      params.push(period);
    }
    
    sql += " ORDER BY period_start DESC";
    
    return await this.query(sql, params);
  }
}

// Database singleton instance
let dbInstance: DatabaseConnection | null = null;

export async function getDatabase(config?: DatabaseConfig): Promise<DatabaseConnection> {
  if (!dbInstance) {
    const defaultConfig: DatabaseConfig = {
      type: "sqlite",
      filename: "btc_terminal.db"
    };
    
    dbInstance = new DatabaseConnection(config || defaultConfig);
    await dbInstance.connect();
    await dbInstance.initialize();
  }
  
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

// Migration utilities
export const migrations = [
  {
    version: 1,
    description: "Initial schema",
    up: async (db: DatabaseConnection) => {
      await db.execute(SIGNALS_TABLE_SCHEMA);
      await db.execute(AGENT_WEIGHTS_TABLE_SCHEMA);
      await db.execute(PERFORMANCE_STATS_TABLE_SCHEMA);
      await db.execute(TRADE_EXECUTIONS_TABLE_SCHEMA);
    }
  },
  {
    version: 2,
    description: "Add indexes for performance",
    up: async (db: DatabaseConnection) => {
      await db.execute("CREATE INDEX IF NOT EXISTS idx_signals_alpha_score ON signals(alpha_score)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_signals_ev ON signals(ev)");
      await db.execute("CREATE INDEX IF NOT EXISTS idx_trade_executions_pnl ON trade_executions(profit_loss)");
    }
  }
];

export async function runMigrations(db: DatabaseConnection): Promise<void> {
  console.log("Running database migrations...");
  
  for (const migration of migrations) {
    console.log(`Running migration v${migration.version}: ${migration.description}`);
    await migration.up(db);
  }
  
  console.log("All migrations completed successfully");
}
