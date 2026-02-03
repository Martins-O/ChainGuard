-- ChainGuard Database Schema
-- PostgreSQL database schema for ChainGuard AI security monitoring platform

-- Create database if it doesn't exist
-- CREATE DATABASE chainguard;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subnets table for Avalanche subnet configuration
CREATE TABLE IF NOT EXISTS subnets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    chain_id VARCHAR(100) UNIQUE NOT NULL,
    rpc_url VARCHAR(500) NOT NULL,
    websocket_url VARCHAR(500) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    monitoring_enabled BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table for storing normalized transaction data
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    subnet_id INTEGER REFERENCES subnets(id),
    block_number BIGINT NOT NULL,
    transaction_index INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value VARCHAR(78) NOT NULL,
    gas_used VARCHAR(78) NOT NULL,
    gas_limit VARCHAR(78) NOT NULL,
    gas_price VARCHAR(78),
    transaction_data JSONB,
    decoded_call JSONB,
    logs JSONB,
    status BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Threat analyses table for AI analysis results
CREATE TABLE IF NOT EXISTS threat_analyses (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    subnet_id INTEGER REFERENCES subnets(id),
    signature_score FLOAT CHECK (signature_score >= 0 AND signature_score <= 100),
    anomaly_score FLOAT CHECK (anomaly_score >= 0 AND anomaly_score <= 100),
    behavioral_score FLOAT CHECK (behavioral_score >= 0 AND behavioral_score <= 100),
    final_score FLOAT NOT NULL CHECK (final_score >= 0 AND final_score <= 100),
    threat_level VARCHAR(20) NOT NULL CHECK (threat_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    explanation TEXT,
    raw_transaction JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table for security alerts
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(36) UNIQUE NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    subnet_id INTEGER REFERENCES subnets(id),
    threat_score FLOAT NOT NULL CHECK (threat_score >= 0 AND threat_score <= 100),
    threat_level VARCHAR(20) NOT NULL CHECK (threat_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    explanation TEXT,
    transaction_data JSONB,
    notification_channels JSONB,
    notification_sent BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,
    false_positive BOOLEAN DEFAULT FALSE,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert logs table for notification tracking
CREATE TABLE IF NOT EXISTS alert_logs (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(36) REFERENCES alerts(alert_id),
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    message TEXT,
    error TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_subnets_chain_id ON subnets(chain_id);
CREATE INDEX IF NOT EXISTS idx_subnets_is_active ON subnets(is_active);
CREATE INDEX IF NOT EXISTS idx_subnets_monitoring_enabled ON subnets(monitoring_enabled);
CREATE INDEX IF NOT EXISTS idx_subnets_created_by ON subnets(created_by);

CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_subnet_id ON transactions(subnet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_block_number ON transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_threat_analyses_tx_hash ON threat_analyses(tx_hash);
CREATE INDEX IF NOT EXISTS idx_threat_analyses_subnet_id ON threat_analyses(subnet_id);
CREATE INDEX IF NOT EXISTS idx_threat_analyses_threat_level ON threat_analyses(threat_level);
CREATE INDEX IF NOT EXISTS idx_threat_analyses_final_score ON threat_analyses(final_score);
CREATE INDEX IF NOT EXISTS idx_threat_analyses_created_at ON threat_analyses(created_at);

CREATE INDEX IF NOT EXISTS idx_alerts_alert_id ON alerts(alert_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tx_hash ON alerts(tx_hash);
CREATE INDEX IF NOT EXISTS idx_alerts_subnet_id ON alerts(subnet_id);
CREATE INDEX IF NOT EXISTS idx_alerts_threat_level ON alerts(threat_level);
CREATE INDEX IF NOT EXISTS idx_alerts_threat_score ON alerts(threat_score);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_false_positive ON alerts(false_positive);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_alert_logs_alert_id ON alert_logs(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_channel ON alert_logs(channel);
CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON alert_logs(status);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at ON alert_logs(sent_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subnets_updated_at BEFORE UPDATE ON subnets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threat_analyses_updated_at BEFORE UPDATE ON threat_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
-- In production, you should change this password immediately
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin', 
    'admin@chainguard.local', 
    '$2b$10$rQZ8ZpZdZpZdZpZdZpZdZOqZ8ZpZdZpZdZpZdZpZdZpZdZpZdZpZdZpZd', 
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Create view for subnet statistics
CREATE OR REPLACE VIEW subnet_stats AS
SELECT 
    s.id,
    s.name,
    s.chain_id,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT CASE WHEN t.status = true THEN t.id END) as successful_transactions,
    COUNT(DISTINCT ta.id) as total_threats,
    COUNT(DISTINCT CASE WHEN ta.threat_level = 'CRITICAL' THEN ta.id END) as critical_threats,
    COUNT(DISTINCT CASE WHEN ta.threat_level = 'HIGH' THEN ta.id END) as high_threats,
    COUNT(DISTINCT CASE WHEN ta.threat_level = 'MEDIUM' THEN ta.id END) as medium_threats,
    COUNT(DISTINCT CASE WHEN ta.threat_level = 'LOW' THEN ta.id END) as low_threats,
    COUNT(DISTINCT a.id) as total_alerts,
    COUNT(DISTINCT CASE WHEN a.acknowledged = true THEN a.id END) as acknowledged_alerts,
    COUNT(DISTINCT CASE WHEN a.false_positive = true THEN a.id END) as false_positive_alerts,
    COALESCE(AVG(ta.final_score), 0) as avg_threat_score,
    COUNT(DISTINCT CASE WHEN DATE(t.created_at) = CURRENT_DATE THEN t.id END) as today_transactions,
    COUNT(DISTINCT CASE WHEN DATE(ta.created_at) = CURRENT_DATE THEN ta.id END) as today_threats,
    COUNT(DISTINCT CASE WHEN DATE(a.created_at) = CURRENT_DATE THEN a.id END) as today_alerts
FROM subnets s
LEFT JOIN transactions t ON s.id = t.subnet_id
LEFT JOIN threat_analyses ta ON s.id = ta.subnet_id
LEFT JOIN alerts a ON s.id = a.subnet_id
GROUP BY s.id, s.name, s.chain_id;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chainguard;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chainguard;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- Create sample data for testing (optional)
-- INSERT INTO subnets (name, chain_id, rpc_url, websocket_url, description, created_by)
-- VALUES (
--     'Avalanche C-Chain',
--     '43114',
--     'https://api.avax.network/ext/bc/C/rpc',
--     'wss://api.avax.network/ext/bc/C/ws',
--     'Avalanche Contract Chain',
--     1
-- ) ON CONFLICT (chain_id) DO NOTHING;