#!/bin/bash

# ChainGuard Database Setup Script
# This script sets up the PostgreSQL database with all necessary tables and indexes

set -e

# Database configuration
DB_NAME=${DB_NAME:-chainguard}
DB_USER=${DB_USER:-chainguard}
DB_PASSWORD=${DB_PASSWORD:-chainguard_password}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting ChainGuard Database Setup${NC}"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U postgres; then
    echo -e "${RED}❌ PostgreSQL is not running or not accessible${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Check if database exists, create if it doesn't
DB_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME || echo "")

if [ -z "$DB_EXISTS" ]; then
    echo -e "${YELLOW}📝 Creating database: $DB_NAME${NC}"
    createdb -h $DB_HOST -p $DB_PORT -U postgres $DB_NAME
    echo -e "${GREEN}✅ Database created successfully${NC}"
else
    echo -e "${GREEN}✅ Database $DB_NAME already exists${NC}"
fi

# Check if user exists, create if it doesn't
USER_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U postgres -d $DB_NAME -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" || echo "")

if [ -z "$USER_EXISTS" ]; then
    echo -e "${YELLOW}👤 Creating database user: $DB_USER${NC}"
    psql -h $DB_HOST -p $DB_PORT -U postgres -d $DB_NAME -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    psql -h $DB_HOST -p $DB_PORT -U postgres -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    echo -e "${GREEN}✅ Database user created successfully${NC}"
else
    echo -e "${GREEN}✅ Database user $DB_USER already exists${NC}"
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# Run migrations in order
echo -e "${YELLOW}🔄 Running database migrations...${NC}"

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        migration_name=$(basename "$migration_file")
        echo -e "${YELLOW}📄 Running migration: $migration_name${NC}"
        
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Migration $migration_name completed successfully${NC}"
        else
            echo -e "${RED}❌ Migration $migration_name failed${NC}"
            exit 1
        fi
    fi
done

# Verify setup
echo -e "${YELLOW}🔍 Verifying database setup...${NC}"

# Check tables
TABLES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")

if [ -n "$TABLES" ]; then
    echo -e "${GREEN}📋 Tables created:${NC}"
    echo "$TABLES" | while read -r table; do
        echo "  - $table"
    done
else
    echo -e "${RED}❌ No tables found${NC}"
    exit 1
fi

# Check indexes
INDEXES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename NOT LIKE 'pg_%';")

if [ -n "$INDEXES" ]; then
    echo -e "${GREEN}🔑 Indexes created: $(echo "$INDEXES" | wc -l)${NC}"
else
    echo -e "${YELLOW}⚠️  No custom indexes found${NC}"
fi

# Test connection and basic query
echo -e "${YELLOW}🧪 Testing database connectivity...${NC}"

TEST_QUERY=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM users;" || echo "")

if [ -n "$TEST_QUERY" ]; then
    echo -e "${GREEN}✅ Database connectivity test passed${NC}"
    echo -e "${GREEN}📊 Default users created: $TEST_QUERY${NC}"
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
echo "  DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo -e "${GREEN}📚 Next Steps:${NC}"
echo "  1. Update .env files with database connection string"
echo "  2. Start the services with: docker-compose up -d"
echo "  3. Access the API at: http://localhost:3000"
echo "  4. Login with default credentials and change password"