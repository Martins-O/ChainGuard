-- Additional indexes for query optimization
-- This migration adds performance-critical indexes for common query patterns

-- Composite indexes for common query patterns

-- Transaction queries by subnet and block number (for chronological queries)
CREATE INDEX IF NOT EXISTS idx_transactions_subnet_block ON transactions(subnet_id, block_number DESC);

-- Transaction queries by subnet and status
CREATE INDEX IF NOT EXISTS idx_transactions_subnet_status ON transactions(subnet_id, status);

-- Transaction queries by from address and subnet
CREATE INDEX IF NOT EXISTS idx_transactions_from_subnet ON transactions(from_address, subnet_id);

-- Transaction queries by to address and subnet
CREATE INDEX IF NOT EXISTS idx_transactions_to_subnet ON transactions(to_address, subnet_id);

-- Threat analyses queries by subnet and threat level
CREATE INDEX IF NOT EXISTS idx_threat_analyses_subnet_level ON threat_analyses(subnet_id, threat_level);

-- Threat analyses queries by subnet and final score range
CREATE INDEX IF NOT EXISTS idx_threat_analyses_subnet_score ON threat_analyses(subnet_id, final_score DESC);

-- Alert queries by subnet and threat level
CREATE INDEX IF NOT EXISTS idx_alerts_subnet_level ON alerts(subnet_id, threat_level);

-- Alert queries by subnet and acknowledgment status
CREATE INDEX IF NOT EXISTS idx_alerts_subnet_acknowledged ON alerts(subnet_id, acknowledged);

-- Alert queries by subnet and created at (for recent alerts)
CREATE INDEX IF NOT EXISTS idx_alerts_subnet_created ON alerts(subnet_id, created_at DESC);

-- Alert logs queries by alert and status
CREATE INDEX IF NOT EXISTS idx_alert_logs_alert_status ON alert_logs(alert_id, status);

-- Alert logs queries by channel and sent at
CREATE INDEX IF NOT EXISTS idx_alert_logs_channel_sent ON alert_logs(channel, sent_at DESC);

-- JSONB indexes for transaction data
CREATE INDEX IF NOT EXISTS idx_transactions_data_gin ON transactions USING GIN(transaction_data);

CREATE INDEX IF NOT EXISTS idx_transactions_decoded_call_gin ON transactions USING GIN(decoded_call);

CREATE INDEX IF NOT EXISTS idx_transactions_logs_gin ON transactions USING GIN(logs);

-- JSONB indexes for threat analyses
CREATE INDEX IF NOT EXISTS idx_threat_analyses_raw_gin ON threat_analyses USING GIN(raw_transaction);

-- JSONB indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_transaction_data_gin ON alerts USING GIN(transaction_data);

CREATE INDEX IF NOT EXISTS idx_alerts_notification_channels_gin ON alerts USING GIN(notification_channels);

-- Partial indexes for common filtered queries
CREATE INDEX IF NOT EXISTS idx_transactions_successful ON transactions(subnet_id, block_number) WHERE status = true;

CREATE INDEX IF NOT EXISTS idx_transactions_failed ON transactions(subnet_id, block_number) WHERE status = false;

CREATE INDEX IF NOT EXISTS idx_threat_analyses_critical ON threat_analyses(subnet_id, created_at DESC) WHERE threat_level = 'CRITICAL';

CREATE INDEX IF NOT EXISTS idx_threat_analyses_high ON threat_analyses(subnet_id, created_at DESC) WHERE threat_level = 'HIGH';

CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged ON alerts(subnet_id, created_at DESC) WHERE acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_alerts_critical_unacknowledged ON alerts(subnet_id, created_at DESC) WHERE threat_level = 'CRITICAL' AND acknowledged = false;

-- Hash indexes for equality checks
CREATE INDEX IF NOT EXISTS idx_transactions_hash_from ON transactions USING HASH(from_address);

CREATE INDEX IF NOT EXISTS idx_transactions_hash_to ON transactions USING HASH(to_address);

-- Create partial index for high-value transactions (value > 1000 AVAX)
-- Note: This requires casting the text value to numeric, which we handle with a functional index
CREATE INDEX IF NOT EXISTS idx_transactions_high_value ON transactions(subnet_id, created_at DESC) 
WHERE (value::numeric > 1000 * 1000000000000000000); -- 1000 AVAX in wei

-- Create index for recent transactions (last 24 hours)
CREATE INDEX IF NOT EXISTS idx_transactions_recent ON transactions(subnet_id, created_at DESC) 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

-- Create index for recent threats (last 24 hours)
CREATE INDEX IF NOT EXISTS idx_threat_analyses_recent ON threat_analyses(subnet_id, created_at DESC) 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

-- Create index for recent alerts (last 24 hours)
CREATE INDEX IF NOT EXISTS idx_alerts_recent ON alerts(subnet_id, created_at DESC) 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

COMMENT ON TABLE transactions IS 'Stores normalized transaction data from Avalanche subnets';
COMMENT ON TABLE threat_analyses IS 'Stores AI analysis results for transactions';
COMMENT ON TABLE alerts IS 'Stores security alerts generated from threat analyses';
COMMENT ON TABLE alert_logs IS 'Stores notification delivery logs for alerts';

-- Comments on important indexes
COMMENT ON INDEX idx_transactions_subnet_block IS 'Optimizes chronological queries by subnet';
COMMENT ON INDEX idx_threat_analyses_subnet_score IS 'Optimizes score-based queries by subnet';
COMMENT ON INDEX idx_alerts_subnet_created IS 'Optimizes recent alert queries by subnet';
COMMENT ON INDEX idx_alerts_critical_unacknowledged IS 'Optimizes critical alert monitoring';