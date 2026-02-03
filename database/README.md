# ChainGuard Database

## Overview
PostgreSQL database schema for ChainGuard AI security monitoring platform.

## Tables

### Users
Authentication and user management.
- `id`: Primary key
- `username`: Unique username
- `email`: Unique email address  
- `password_hash`: Bcrypt hash
- `role`: user/admin
- `is_active`: Account status
- `created_at/updated_at`: Timestamps

### Subnets
Avalanche subnet configuration.
- `id`: Primary key
- `name`: Display name
- `chain_id`: Unique chain identifier
- `rpc_url`: RPC endpoint
- `websocket_url`: WebSocket endpoint
- `description`: Optional description
- `is_active`: Subnet status
- `monitoring_enabled`: Monitoring status
- `created_by`: Creator user ID
- `created_at/updated_at`: Timestamps

### Transactions
Normalized transaction data.
- `id`: Primary key
- `tx_hash`: Unique transaction hash
- `subnet_id`: Reference to subnet
- `block_number`: Block number
- `transaction_index`: Index in block
- `from_address/to_address`: Sender/recipient
- `value`: Transaction value
- `gas_used/gas_limit/gas_price`: Gas metrics
- `transaction_data`: Full transaction JSON
- `decoded_call`: Decoded function call JSON
- `logs`: Transaction logs JSON
- `status`: Success/failure
- `created_at`: Ingestion timestamp

### Threat Analyses
AI analysis results.
- `id`: Primary key
- `tx_hash`: Transaction hash
- `subnet_id`: Reference to subnet
- `signature_score`: Pattern detection score
- `anomaly_score`: Anomaly detection score
- `behavioral_score`: Behavioral analysis score
- `final_score`: Combined threat score (0-100)
- `threat_level`: LOW/MEDIUM/HIGH/CRITICAL
- `explanation`: Human-readable explanation
- `raw_transaction`: Raw transaction data
- `created_at/updated_at`: Timestamps

### Alerts
Security alerts.
- `id`: Primary key
- `alert_id`: Unique alert identifier
- `tx_hash`: Related transaction
- `subnet_id`: Reference to subnet
- `threat_score`: AI-calculated score
- `threat_level`: Threat classification
- `explanation`: Alert explanation
- `transaction_data`: Transaction data JSON
- `notification_channels`: Channels used JSON
- `notification_sent`: Delivery status
- `acknowledged/false_positive`: Alert status
- `acknowledged_by/acknowledged_at`: Acknowledgment info
- `created_at/updated_at`: Timestamps

### Alert Logs
Notification delivery tracking.
- `id`: Primary key
- `alert_id`: Reference to alert
- `channel`: Notification channel used
- `status`: sent/failed/pending
- `message/error`: Delivery details
- `sent_at`: Timestamp

## Views

### subnet_stats
Aggregated statistics by subnet:
- Transaction counts (total/successful)
- Threat counts (by level)
- Alert counts (total/acknowledged/false positives)
- Average threat scores
- Daily activity metrics

## Setup

### Quick Setup
```bash
cd database
chmod +x setup.sh
./setup.sh
```

### Manual Setup
1. Create database:
```sql
CREATE DATABASE chainguard;
```

2. Create user:
```sql
CREATE USER chainguard WITH PASSWORD 'chainguard_password';
GRANT ALL PRIVILEGES ON DATABASE chainguard TO chainguard;
```

3. Run migrations:
```bash
psql -h localhost -U chainguard -d chainguard -f migrations/001_initial_schema.sql
psql -h localhost -U chainguard -d chainguard -f migrations/002_performance_indexes.sql
```

## Environment Variables

- `DB_NAME`: Database name (default: chainguard)
- `DB_USER`: Database user (default: chainguard)
- `DB_PASSWORD`: Database password (default: chainguard_password)
- `DB_HOST`: Database host (default: localhost)
- `DB_PORT`: Database port (default: 5432)

## Connection String

```
postgresql://chainguard:chainguard_password@localhost:5432/chainguard
```

## Default Admin User

The setup creates a default admin user:
- Username: `admin`
- Password: `admin123`

⚠️ **Security**: Change this password immediately after first login!

## Indexes

The schema includes comprehensive indexing:

- **Primary Keys**: All tables have indexed primary keys
- **Foreign Keys**: All foreign keys are indexed
- **Query Optimization**: Composite indexes for common query patterns
- **JSONB**: GIN indexes for JSON data
- **Partial Indexes**: Optimized for filtered queries
- **Time-based**: Indexes for recent data queries

## Performance Features

- **Composite Indexes**: Multi-column queries optimized
- **Partial Indexes**: Smaller, faster indexes for filtered data
- **JSONB Indexing**: Efficient JSON document queries
- **Time-based Indexes**: Recent queries optimized
- **Functional Indexes**: Computed value queries

## Data Retention

Consider implementing retention policies for production:

```sql
-- Example: Delete old alert logs (keep 90 days)
DELETE FROM alert_logs WHERE sent_at < CURRENT_DATE - INTERVAL '90 days';

-- Example: Archive old transactions (keep 1 year)
DELETE FROM transactions WHERE created_at < CURRENT_DATE - INTERVAL '1 year';
```

## Backup Strategy

### Daily Backup
```bash
pg_dump -h localhost -U chainguard chainguard > backup_$(date +%Y%m%d).sql
```

### Automated Backup
```bash
# Add to crontab for daily 2 AM backups
0 2 * * * /path/to/backup_script.sh
```

## Monitoring

Key metrics to monitor:
- Connection count
- Query performance
- Table sizes
- Index usage
- Lock contention

## Scaling Considerations

### Read Replicas
For high read workloads:
```sql
CREATE USER readonly_user WITH PASSWORD 'readonly_pass';
GRANT CONNECT ON DATABASE chainguard TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
```

### Partitioning
For large tables, consider partitioning:
- Transactions by date
- Alert logs by date
- Threat analyses by subnet/date

## Security

- **Row Level Security**: Implement for multi-tenant scenarios
- **Encryption**: Enable data-at-rest encryption
- **Auditing**: Enable PostgreSQL audit logging
- **Network**: Restrict database access to application servers

## Migration Process

1. Create new migration file: `003_feature_name.sql`
2. Write forward migration
3. Test migration on copy of production data
4. Deploy during maintenance window
5. Update setup script if needed

## Troubleshooting

### Connection Issues
```bash
# Test connection
psql -h localhost -U chainguard -d chainguard -c "SELECT version();"
```

### Performance Issues
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename = 'transactions';
```

### Lock Issues
```sql
-- Check for locks
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```