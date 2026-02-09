// MongoDB Initialization Script for ChainGuard
// This script creates all necessary indexes for optimal query performance

print('Starting MongoDB initialization for ChainGuard...');

// Switch to chainguard database
db = db.getSiblingDB('chainguard');

// Users Collection Indexes
print('Creating indexes for users collection...');
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isActive: 1 });

// Subnets Collection Indexes
print('Creating indexes for subnets collection...');
db.subnets.createIndex({ chainId: 1 }, { unique: true });
db.subnets.createIndex({ isActive: 1 });
db.subnets.createIndex({ monitoringEnabled: 1 });
db.subnets.createIndex({ 'createdBy.userId': 1 });

// Transactions Collection Indexes
print('Creating indexes for transactions collection...');
db.transactions.createIndex({ txHash: 1 }, { unique: true });
db.transactions.createIndex({ 'subnet.subnetId': 1, blockNumber: -1 });
db.transactions.createIndex({ fromAddress: 1, 'subnet.subnetId': 1 });
db.transactions.createIndex({ toAddress: 1, 'subnet.subnetId': 1 });
db.transactions.createIndex({ status: 1 });
db.transactions.createIndex({ createdAt: -1 });
db.transactions.createIndex({ 'subnet.subnetId': 1, status: 1 });
db.transactions.createIndex({ 'subnet.subnetId': 1, fromAddress: 1 });

// Threat Analyses Collection Indexes
print('Creating indexes for threat_analyses collection...');
db.threat_analyses.createIndex({ txHash: 1 }, { unique: true });
db.threat_analyses.createIndex({ 'subnet.subnetId': 1, threatLevel: 1 });
db.threat_analyses.createIndex({ 'subnet.subnetId': 1, 'scores.final': -1 });
db.threat_analyses.createIndex({ threatLevel: 1 });
db.threat_analyses.createIndex({ 'scores.final': -1 });
db.threat_analyses.createIndex({ createdAt: -1 });
db.threat_analyses.createIndex({ 'subnet.subnetId': 1, createdAt: -1 });

// Alerts Collection Indexes
print('Creating indexes for alerts collection...');
db.alerts.createIndex({ alertId: 1 }, { unique: true });
db.alerts.createIndex({ txHash: 1 });
db.alerts.createIndex({ 'subnet.subnetId': 1, createdAt: -1 });
db.alerts.createIndex({ threatLevel: 1 });
db.alerts.createIndex({ acknowledged: 1 });
db.alerts.createIndex({ falsePositive: 1 });
db.alerts.createIndex({ notificationSent: 1 });
db.alerts.createIndex({ 'subnet.subnetId': 1, threatLevel: 1 });
db.alerts.createIndex({ 'subnet.subnetId': 1, acknowledged: 1 });

// Partial index for critical unacknowledged alerts
db.alerts.createIndex(
  { 'subnet.subnetId': 1, createdAt: -1 },
  {
    partialFilterExpression: {
      acknowledged: false,
      threatLevel: 'CRITICAL'
    },
    name: 'critical_unacknowledged_idx'
  }
);

// Alert Logs Collection Indexes
print('Creating indexes for alert_logs collection...');
db.alert_logs.createIndex({ alertId: 1 });
db.alert_logs.createIndex({ channel: 1 });
db.alert_logs.createIndex({ status: 1 });
db.alert_logs.createIndex({ sentAt: -1 });

// TTL index for alert_logs (expire after 30 days)
db.alert_logs.createIndex(
  { sentAt: 1 },
  { expireAfterSeconds: 2592000, name: 'alert_logs_ttl' }
);

// Feature Store Collection Indexes (for ML model retraining)
print('Creating indexes for feature_store collection...');
db.feature_store.createIndex({ txHash: 1 });
db.feature_store.createIndex({ modelVersion: 1 });
db.feature_store.createIndex({ humanVerified: 1 });
db.feature_store.createIndex({ modelVersion: 1, humanVerified: 1 });
db.feature_store.createIndex({ capturedAt: -1 });

// Text indexes for search functionality
print('Creating text indexes...');
db.threat_analyses.createIndex({ explanation: 'text' });
db.alerts.createIndex({ explanation: 'text' });

print('MongoDB initialization complete!');
print('Created indexes for: users, subnets, transactions, threat_analyses, alerts, alert_logs, feature_store');
