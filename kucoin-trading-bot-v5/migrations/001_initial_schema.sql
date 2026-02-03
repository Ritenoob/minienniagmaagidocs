-- KuCoin Futures Trading Bot - Initial Database Schema
-- PostgreSQL 16 compatible

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SIGNALS TABLE
-- Stores generated trading signals
-- ============================================
CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    signal_type VARCHAR(20) NOT NULL,  -- EXTREME_BUY, STRONG_BUY, BUY, etc.
    score DECIMAL(10, 4) NOT NULL,      -- -220 to +220
    confidence DECIMAL(5, 4) NOT NULL,  -- 0.0 to 1.0
    indicator_score DECIMAL(10, 4),
    microstructure_score DECIMAL(10, 4),
    indicator_count INTEGER,
    timeframe VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for time-based queries
    CONSTRAINT valid_score CHECK (score >= -220 AND score <= 220),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX idx_signals_symbol ON signals(symbol);
CREATE INDEX idx_signals_created_at ON signals(created_at DESC);
CREATE INDEX idx_signals_symbol_time ON signals(symbol, created_at DESC);

-- ============================================
-- ORDERS TABLE
-- Stores all order records
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange_order_id VARCHAR(50),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,          -- buy, sell
    order_type VARCHAR(20) NOT NULL,    -- limit, market, stop
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    stop_price DECIMAL(20, 8),
    leverage INTEGER DEFAULT 1,
    status VARCHAR(20) NOT NULL,        -- pending, filled, cancelled, rejected
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    avg_fill_price DECIMAL(20, 8),
    fee DECIMAL(20, 8) DEFAULT 0,
    signal_id UUID REFERENCES signals(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    filled_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_side CHECK (side IN ('buy', 'sell')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'filled', 'partially_filled', 'cancelled', 'rejected'))
);

CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================
-- POSITIONS TABLE
-- Tracks open positions
-- ============================================
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,          -- long, short
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    quantity DECIMAL(20, 8) NOT NULL,
    leverage INTEGER NOT NULL DEFAULT 1,
    margin DECIMAL(20, 8),
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    realized_pnl DECIMAL(20, 8) DEFAULT 0,
    roi_percent DECIMAL(10, 4) DEFAULT 0,
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    trailing_stop_enabled BOOLEAN DEFAULT FALSE,
    trailing_stop_distance DECIMAL(10, 4),
    liquidation_price DECIMAL(20, 8),
    entry_order_id UUID REFERENCES orders(id),
    signal_id UUID REFERENCES signals(id),
    is_open BOOLEAN DEFAULT TRUE,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    close_reason VARCHAR(50),           -- stop_loss, take_profit, manual, signal, liquidation
    
    CONSTRAINT valid_position_side CHECK (side IN ('long', 'short')),
    CONSTRAINT valid_leverage CHECK (leverage >= 1 AND leverage <= 100)
);

CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_is_open ON positions(is_open);
CREATE INDEX idx_positions_opened_at ON positions(opened_at DESC);

-- ============================================
-- TRADES TABLE
-- Completed trade history
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    exit_price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    leverage INTEGER NOT NULL,
    gross_pnl DECIMAL(20, 8) NOT NULL,
    net_pnl DECIMAL(20, 8) NOT NULL,
    fees DECIMAL(20, 8) DEFAULT 0,
    roi_percent DECIMAL(10, 4) NOT NULL,
    duration_seconds INTEGER,
    exit_reason VARCHAR(50),
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_closed_at ON trades(closed_at DESC);
CREATE INDEX idx_trades_pnl ON trades(net_pnl);

-- ============================================
-- PERFORMANCE_METRICS TABLE
-- Daily/hourly performance snapshots
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_type VARCHAR(10) NOT NULL,   -- hourly, daily, weekly
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 4) DEFAULT 0,
    gross_pnl DECIMAL(20, 8) DEFAULT 0,
    net_pnl DECIMAL(20, 8) DEFAULT 0,
    total_fees DECIMAL(20, 8) DEFAULT 0,
    max_drawdown DECIMAL(10, 4) DEFAULT 0,
    sharpe_ratio DECIMAL(10, 4),
    profit_factor DECIMAL(10, 4),
    avg_trade_duration INTEGER,
    equity_start DECIMAL(20, 8),
    equity_end DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(period_type, period_start)
);

CREATE INDEX idx_metrics_period ON performance_metrics(period_type, period_start DESC);

-- ============================================
-- CIRCUIT_BREAKER_EVENTS TABLE
-- Records circuit breaker activations
-- ============================================
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reason VARCHAR(100) NOT NULL,       -- max_daily_drawdown, consecutive_losses, manual
    trigger_value DECIMAL(20, 8),
    threshold_value DECIMAL(20, 8),
    equity_at_trigger DECIMAL(20, 8),
    positions_closed INTEGER DEFAULT 0,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(50)             -- auto, manual
);

CREATE INDEX idx_circuit_breaker_triggered ON circuit_breaker_events(triggered_at DESC);

-- ============================================
-- BOT_CONFIG TABLE
-- Runtime configuration storage
-- ============================================
CREATE TABLE IF NOT EXISTS bot_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO bot_config (key, value, description) VALUES
    ('risk_management', '{"max_daily_drawdown": 0.03, "max_position_size": 0.05, "default_leverage": 6, "max_leverage": 10}', 'Risk management parameters'),
    ('signal_thresholds', '{"min_score": 50, "strong_score": 70, "extreme_score": 90, "min_confidence": 0.85}', 'Signal generation thresholds'),
    ('trading_mode', '"paper"', 'Current trading mode: paper or live'),
    ('symbols_config', '{"auto_discovery": true, "max_symbols": 50, "min_volume_24h": 10000000}', 'Symbol selection configuration')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- AUDIT_LOG TABLE
-- System audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    user_agent VARCHAR(255),
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_event ON audit_log(event_type);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for orders table
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- View for open positions summary
CREATE OR REPLACE VIEW open_positions_summary AS
SELECT 
    symbol,
    side,
    quantity,
    entry_price,
    current_price,
    leverage,
    unrealized_pnl,
    roi_percent,
    stop_loss,
    take_profit,
    opened_at,
    EXTRACT(EPOCH FROM (NOW() - opened_at)) AS duration_seconds
FROM positions
WHERE is_open = TRUE;

-- View for daily performance
CREATE OR REPLACE VIEW daily_performance AS
SELECT 
    DATE(closed_at) AS trade_date,
    COUNT(*) AS total_trades,
    SUM(CASE WHEN net_pnl > 0 THEN 1 ELSE 0 END) AS winning_trades,
    SUM(CASE WHEN net_pnl <= 0 THEN 1 ELSE 0 END) AS losing_trades,
    ROUND(SUM(CASE WHEN net_pnl > 0 THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) * 100, 2) AS win_rate_pct,
    SUM(gross_pnl) AS gross_pnl,
    SUM(net_pnl) AS net_pnl,
    SUM(fees) AS total_fees,
    AVG(roi_percent) AS avg_roi_pct
FROM trades
GROUP BY DATE(closed_at)
ORDER BY trade_date DESC;

-- ============================================
-- GRANT PERMISSIONS (for bot user)
-- ============================================
-- Uncomment if using separate database user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bot;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bot;
