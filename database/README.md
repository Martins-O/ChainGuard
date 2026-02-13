# ChainGuard Database

## Overview
MongoDB database schema for ChainGuard AI security monitoring platform.

## Collections

### Users
Authentication and user management.
- `_id`: MongoDB ObjectId (primary key)
- `username`: Unique username (indexed)
- `email`: Unique email address (indexed)
- `password_hash`: Bcrypt hash
- `role`: user/admin
- `is_active`: Account status
- `created_at/updated_at`: Timestamps

### Subnets
Avalanche subnet configuration.
- `_id`: MongoDB ObjectId (primary key)
- `name`: Display name
- `chain_id`: Unique chain identifier (indexed, unique)
- `rpc_url`: RPC endpoint
- `websocket_url`: WebSocket endpoint
- `description`: Optional description
- `is_active`: Subnet status (indexed)
- `monitoring_enabled`: Monitoring status (indexed)
- `created_by`: Creator user ObjectId reference
- `created_at/updated_at`: Timestamps

### Transactions
Normalized transaction data.
- `_id`: MongoDB ObjectId (primary key)
- `tx_hash`: Unique transaction hash (indexed, unique)
- `subnet_id`: Reference to subnet ObjectId (indexed)
- `block_number`: Block number (indexed)
- `transaction_index`: Index in block
- `from_address/to_address`: Sender/recipient (indexed)
- `value`: Transaction value
- `gas_used/gas_limit/gas_price`: Gas metrics
- `transaction_data`: Full transaction document
- `decoded_call`: Decoded function call document
- `logs`: Transaction logs array
- `status`: Success/failure (indexed)
- `created_at`: Ingestion timestamp (indexed)

### Threat Analyses
AI analysis results.
- `_id`: MongoDB ObjectId (primary key)
- `tx_hash`: Transaction hash (indexed, unique)
- `subnet_id`: Reference to subnet ObjectId (indexed)
- `signature_score`: Pattern detection score
- `anomaly_score`: Anomaly detection score
- `behavioral_score`: Behavioral analysis score
- `final_score`: Combined threat score (0-100) (indexed)
- `threat_level`: LOW/MEDIUM/HIGH/CRITICAL (indexed)
- `explanation`: Human-readable explanation
- `raw_transaction`: Raw transaction document
- `created_at/updated_at`: Timestamps (indexed)

### Alerts
Security alerts.
- `_id`: MongoDB ObjectId (primary key)
- `alert_id`: Unique alert identifier (indexed, unique)
- `tx_hash`: Related transaction (indexed)
- `subnet_id`: Reference to subnet ObjectId (indexed)
- `threat_score`: AI-calculated score (indexed)
- `threat_level`: Threat classification (indexed)
- `explanation`: Alert explanation
- `transaction_data`: Transaction data document
- `notification_channels`: Channels used array
- `notification_sent`: Delivery status
- `acknowledged/false_positive`: Alert status (indexed)
- `acknowledged_by/acknowledged_at`: Acknowledgment info
- `created_at/updated_at`: Timestamps (indexed)

### Alert Logs
Notification delivery tracking.
- `_id`: MongoDB ObjectId (primary key)
- `alert_id`: Reference to alert (indexed)
- `channel`: Notification channel used (indexed)
- `status`: sent/failed/pending (indexed)
- `message/error`: Delivery details
- `sent_at`: Timestamp (indexed)

## Setup

### Quick Setup
```bash
cd database
chmod +x setup.sh
./setup.sh
```

### Manual Setup
1. Start MongoDB:
```bash
# Docker
docker-compose up -d mongodb

# Or local
mongod
```

2. Connect and create database:
```javascript
mongosh
use chainguard
```

3. Create user:
```javascript
db.createUser({
  user: 'chainguard',
  pwd: 'chainguard_password',
  roles: [{ role: 'readWrite', db: 'chainguard' }]
})
```

4. Run setup script:
```bash
./setup.sh
```

## Environment Variables

- `DB_NAME`: Database name (default: chainguard)
- `DB_USER`: Database user (default: chainguard)
- `DB_PASSWORD`: Database password (default: chainguard_password)
- `DB_HOST`: Database host (default: localhost)
- `DB_PORT`: Database port (default: 27017)

## Connection String

```
mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin
```

## Default Admin User

The setup creates a default admin user:
- Username: `admin`
- Password: `admin123`

⚠️ **Security**: Change this password immediately after first login!

## Indexes

The schema includes comprehensive indexing:

- **Unique Indexes**: Username, email, chain_id, tx_hash, alert_id
- **Query Optimization**: Indexes on frequently queried fields
- **Compound Indexes**: Multi-field queries optimized
- **Time-based**: Indexes for recent data queries (created_at descending)

## Performance Features

- **Indexes**: Optimized indexes for common query patterns
- **Aggregation Pipeline**: Efficient data aggregation
- **Connection Pooling**: Automatic connection management
- **Sharding Ready**: Can be sharded for horizontal scaling

## Data Retention

Consider implementing retention policies for production:

```javascript
// Example: Delete old alert logs (keep 90 days)
db.alert_logs.deleteMany({
  sent_at: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
});

// Example: Archive old transactions (keep 1 year)
db.transactions.deleteMany({
  created_at: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
});
```

## Backup Strategy

### Daily Backup
```bash
mongodump --uri="mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin" --out=backup_$(date +%Y%m%d)
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
- Collection sizes
- Index usage
- Replication lag (if using replica set)

## Scaling Considerations

### Replica Sets
For high availability:
```javascript
// Configure replica set
rs.initiate({
  _id: "chainguard-rs",
  members: [
    { _id: 0, host: "mongodb1:27017" },
    { _id: 1, host: "mongodb2:27017" },
    { _id: 2, host: "mongodb3:27017" }
  ]
})
```

### Sharding
For horizontal scaling:
- Shard by subnet_id for transactions
- Shard by date for time-series data
- Use compound shard keys for optimal distribution

## Security

- **Authentication**: Enable MongoDB authentication
- **Encryption**: Enable data-at-rest and in-transit encryption
- **Auditing**: Enable MongoDB audit logging
- **Network**: Restrict database access to application servers
- **Role-Based Access**: Use least privilege principle

## Migration Process

1. Create new collection or update schema
2. Update indexes if needed
3. Test on copy of production data
4. Deploy during maintenance window
5. Update setup script if needed

## Troubleshooting

### Connection Issues
```bash
# Test connection
mongosh "mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin"
```

### Performance Issues
```javascript
// Check slow queries
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(10).pretty();

// Check index usage
db.transactions.getIndexes();

// Analyze query
db.transactions.find({ tx_hash: "0x..." }).explain("executionStats");
```

### Index Issues
```javascript
// View all indexes
db.collection.getIndexes();

// Create missing index
db.collection.createIndex({ field: 1 });

// Drop unused index
db.collection.dropIndex({ field: 1 });
```
