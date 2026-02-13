#!/bin/bash

# ChainGuard Database Setup Script
# This script sets up the MongoDB database with all necessary collections and indexes

set -e

# Database configuration
DB_NAME=${DB_NAME:-chainguard}
DB_USER=${DB_USER:-chainguard}
DB_PASSWORD=${DB_PASSWORD:-chainguard_password}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-27017}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting ChainGuard Database Setup${NC}"

# Check if MongoDB is running
if ! mongosh --host $DB_HOST:$DB_PORT --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo -e "${RED}❌ MongoDB is not running or not accessible${NC}"
    echo -e "${YELLOW}💡 Start MongoDB with: docker-compose up -d mongodb${NC}"
    exit 1
fi

echo -e "${GREEN}✅ MongoDB is running${NC}"

# Connection string
CONNECTION_STRING="mongodb://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?authSource=admin"

# Create collections and indexes using MongoDB shell
echo -e "${YELLOW}🔄 Setting up database collections and indexes...${NC}"

mongosh "$CONNECTION_STRING" --quiet <<EOF
// Create collections if they don't exist
db.createCollection("users");
db.createCollection("subnets");
db.createCollection("transactions");
db.createCollection("threat_analyses");
db.createCollection("alerts");
db.createCollection("alert_logs");

// Create indexes for users
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

// Create indexes for subnets
db.subnets.createIndex({ chain_id: 1 }, { unique: true });
db.subnets.createIndex({ is_active: 1 });
db.subnets.createIndex({ monitoring_enabled: 1 });
db.subnets.createIndex({ created_by: 1 });

// Create indexes for transactions
db.transactions.createIndex({ tx_hash: 1 }, { unique: true });
db.transactions.createIndex({ subnet_id: 1 });
db.transactions.createIndex({ from_address: 1 });
db.transactions.createIndex({ to_address: 1 });
db.transactions.createIndex({ block_number: 1 });
db.transactions.createIndex({ status: 1 });
db.transactions.createIndex({ created_at: -1 });

// Create indexes for threat_analyses
db.threat_analyses.createIndex({ tx_hash: 1 }, { unique: true });
db.threat_analyses.createIndex({ subnet_id: 1 });
db.threat_analyses.createIndex({ threat_level: 1 });
db.threat_analyses.createIndex({ final_score: 1 });
db.threat_analyses.createIndex({ created_at: -1 });

// Create indexes for alerts
db.alerts.createIndex({ alert_id: 1 }, { unique: true });
db.alerts.createIndex({ tx_hash: 1 });
db.alerts.createIndex({ subnet_id: 1 });
db.alerts.createIndex({ threat_level: 1 });
db.alerts.createIndex({ threat_score: 1 });
db.alerts.createIndex({ acknowledged: 1 });
db.alerts.createIndex({ false_positive: 1 });
db.alerts.createIndex({ created_at: -1 });

// Create indexes for alert_logs
db.alert_logs.createIndex({ alert_id: 1 });
db.alert_logs.createIndex({ channel: 1 });
db.alert_logs.createIndex({ status: 1 });
db.alert_logs.createIndex({ sent_at: -1 });

// Create default admin user (password: admin123)
const bcrypt = require('bcryptjs');
const adminPasswordHash = bcrypt.hashSync('admin123', 10);
db.users.updateOne(
  { username: 'admin' },
  {
    \$setOnInsert: {
      username: 'admin',
      email: 'admin@chainguard.local',
      password_hash: adminPasswordHash,
      role: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  },
  { upsert: true }
);

print("✅ Collections and indexes created successfully");
EOF
        
        if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database setup completed successfully${NC}"
        else
    echo -e "${RED}❌ Database setup failed${NC}"
            exit 1
        fi

# Verify setup
echo -e "${YELLOW}🔍 Verifying database setup...${NC}"

COLLECTIONS=$(mongosh "$CONNECTION_STRING" --quiet --eval "db.getCollectionNames().join(',')")

if [ -n "$COLLECTIONS" ]; then
    echo -e "${GREEN}📋 Collections created:${NC}"
    echo "$COLLECTIONS" | tr ',' '\n' | while read -r collection; do
        echo "  - $collection"
    done
else
    echo -e "${RED}❌ No collections found${NC}"
    exit 1
fi

# Test connection and basic query
echo -e "${YELLOW}🧪 Testing database connectivity...${NC}"

USER_COUNT=$(mongosh "$CONNECTION_STRING" --quiet --eval "db.users.countDocuments()")

if [ -n "$USER_COUNT" ]; then
    echo -e "${GREEN}✅ Database connectivity test passed${NC}"
    echo -e "${GREEN}📊 Users in database: $USER_COUNT${NC}"
else
    echo -e "${RED}❌ Database connectivity test failed${NC}"
    exit 1
fi

# Display connection information
echo -e "${GREEN}🎉 Database setup completed successfully!${NC}"
echo ""
echo -e "${GREEN}📋 Connection Information:${NC}"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo ""
echo -e "${GREEN}🔑 Default Login:${NC}"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo -e "${YELLOW}⚠️  SECURITY NOTE: Please change the default admin password immediately after first login!${NC}"
echo ""
echo -e "${GREEN}🐳 Docker Compose Connection String:${NC}"
echo "  DATABASE_URL=mongodb://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?authSource=admin"
echo ""
echo -e "${GREEN}📚 Next Steps:${NC}"
echo "  1. Update .env files with database connection string"
echo "  2. Start the services with: docker-compose up -d"
echo "  3. Access the API at: http://localhost:3000"
echo "  4. Login with default credentials and change password"
