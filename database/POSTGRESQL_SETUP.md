# PostgreSQL Setup Guide for ChainGuard AI

This guide provides comprehensive instructions for setting up and configuring PostgreSQL for the ChainGuard AI security monitoring platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [Configuration](#configuration)
5. [Migration Execution](#migration-execution)
6. [Connection Testing](#connection-testing)
7. [Backup and Restore](#backup-and-restore)
8. [Performance Tuning](#performance-tuning)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- PostgreSQL 12 or higher
- Administrative access to PostgreSQL
- Basic knowledge of SQL and command line

## Installation

### macOS

```bash
# Using Homebrew
brew install postgresql@14
brew services start postgresql@14
```

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows

1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` superuser

### Docker (Recommended for Development)

```bash
# Pull PostgreSQL image
docker pull postgres:14

# Run PostgreSQL container
docker run --name chainguard-postgres \
  -e POSTGRES_USER=chainguard \
  -e POSTGRES_PASSWORD=chainguard_password \
  -e POSTGRES_DB=chainguard \
  -p 5432:5432 \
  -d postgres:14

# Or use docker-compose (already configured in project root)
docker-compose up -d postgres
```

## Database Setup

### Step 1: Access PostgreSQL

```bash
# macOS/Linux
psql -U postgres

# Windows (if installed via installer)
psql -U postgres

# Docker
docker exec -it chainguard-postgres psql -U chainguard
```

### Step 2: Create Database

```sql
-- Create database
CREATE DATABASE chainguard;

-- Verify creation
\l
```

### Step 3: Create User

```sql
-- Create user with password
CREATE USER chainguard WITH PASSWORD 'chainguard_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE chainguard TO chainguard;

-- Grant schema privileges (if needed)
\c chainguard
GRANT ALL ON SCHEMA public TO chainguard;
```

### Step 4: Verify Setup

```sql
-- Connect to database
\c chainguard

-- List tables (should be empty initially)
\dt

-- Check user privileges
\du
```

## Configuration

### Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Example:**
```
postgresql://chainguard:chainguard_password@localhost:5432/chainguard
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL=postgresql://chainguard:chainguard_password@localhost:5432/chainguard
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chainguard
DB_USER=chainguard
DB_PASSWORD=chainguard_password

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
```

### PostgreSQL Configuration File

Location:
- **macOS/Linux**: `/usr/local/var/postgres/postgresql.conf` or `/etc/postgresql/[version]/main/postgresql.conf`
- **Windows**: `C:\Program Files\PostgreSQL\[version]\data\postgresql.conf`
- **Docker**: Edit via `docker exec` or volume mount

Key settings for ChainGuard:

```conf
# Memory Settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB

# Connection Settings
max_connections = 100
listen_addresses = '*'

# Logging
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'mod'
log_duration = on

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200
```

## Migration Execution

### Automated Setup (Recommended)

```bash
# Navigate to database directory
cd database

# Make setup script executable
chmod +x setup.sh

# Run setup script
./setup.sh
```

The setup script will:
1. Create database and user (if they don't exist)
2. Run all migration files in order
3. Create indexes
4. Insert default admin user
5. Verify setup

### Manual Migration

```bash
# Connect to database
psql -h localhost -U chainguard -d chainguard

# Run migrations in order
\i migrations/001_initial_schema.sql
\i migrations/002_performance_indexes.sql
```

Or from command line:

```bash
psql -h localhost -U chainguard -d chainguard -f migrations/001_initial_schema.sql
psql -h localhost -U chainguard -d chainguard -f migrations/002_performance_indexes.sql
```

## Connection Testing

### Using psql

```bash
psql -h localhost -U chainguard -d chainguard -c "SELECT version();"
```

### Using Node.js

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', (err, res) => {
  console.log(err, res);
  pool.end();
});
```

### Using Python

```python
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="chainguard",
    user="chainguard",
    password="chainguard_password"
)

cur = conn.cursor()
cur.execute("SELECT version();")
print(cur.fetchone())
conn.close()
```

## Backup and Restore

### Create Backup

```bash
# Full database backup
pg_dump -h localhost -U chainguard -d chainguard -F c -f backup_$(date +%Y%m%d).dump

# SQL format backup
pg_dump -h localhost -U chainguard -d chainguard -f backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U chainguard -d chainguard | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore Backup

```bash
# From custom format
pg_restore -h localhost -U chainguard -d chainguard backup_20240101.dump

# From SQL file
psql -h localhost -U chainguard -d chainguard -f backup_20240101.sql

# From compressed SQL
gunzip < backup_20240101.sql.gz | psql -h localhost -U chainguard -d chainguard
```

### Automated Backups

Create a backup script (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/chainguard_$DATE.dump"

pg_dump -h localhost -U chainguard -d chainguard -F c -f "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "chainguard_*.dump" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

Add to crontab for daily backups at 2 AM:

```bash
crontab -e
# Add this line:
0 2 * * * /path/to/backup.sh
```

## Performance Tuning

### Analyze Tables

```sql
-- Analyze all tables
ANALYZE;

-- Analyze specific table
ANALYZE transactions;

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Check Index Usage

```sql
-- View index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Monitor Query Performance

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
SELECT pg_reload_conf();

-- View slow queries (requires pg_stat_statements extension)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Table Size Monitoring

```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Troubleshooting

### Connection Refused

**Problem**: `psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed`

**Solutions**:
1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   
   # Docker
   docker ps | grep postgres
   ```

2. Verify port is not blocked:
   ```bash
   netstat -an | grep 5432
   ```

3. Check PostgreSQL logs:
   ```bash
   # macOS
   tail -f /usr/local/var/postgres/server.log
   
   # Linux
   tail -f /var/log/postgresql/postgresql-*.log
   ```

### Authentication Failed

**Problem**: `password authentication failed for user "chainguard"`

**Solutions**:
1. Reset password:
   ```sql
   ALTER USER chainguard WITH PASSWORD 'new_password';
   ```

2. Check `pg_hba.conf` file:
   ```bash
   # Find location
   psql -U postgres -c "SHOW hba_file;"
   
   # Edit to allow password authentication
   # Change: local all all peer
   # To: local all all md5
   ```

3. Reload configuration:
   ```sql
   SELECT pg_reload_conf();
   ```

### Database Does Not Exist

**Problem**: `database "chainguard" does not exist`

**Solution**:
```sql
CREATE DATABASE chainguard;
```

### Permission Denied

**Problem**: `permission denied for table [table_name]`

**Solution**:
```sql
-- Grant privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chainguard;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chainguard;
GRANT ALL PRIVILEGES ON DATABASE chainguard TO chainguard;
```

### High Memory Usage

**Problem**: PostgreSQL consuming too much memory

**Solutions**:
1. Adjust `shared_buffers` in `postgresql.conf`
2. Reduce `max_connections`
3. Monitor with:
   ```sql
   SELECT * FROM pg_stat_activity;
   ```

### Slow Queries

**Problem**: Queries taking too long

**Solutions**:
1. Analyze tables: `ANALYZE;`
2. Check for missing indexes
3. Use `EXPLAIN ANALYZE` to identify bottlenecks
4. Consider partitioning large tables

## Security Best Practices

1. **Change Default Passwords**: Always change default database passwords
2. **Limit Network Access**: Restrict PostgreSQL to localhost or specific IPs
3. **Use SSL**: Enable SSL for remote connections
4. **Regular Updates**: Keep PostgreSQL updated
5. **Backup Encryption**: Encrypt database backups
6. **Role-Based Access**: Use least privilege principle
7. **Audit Logging**: Enable audit logging for sensitive operations

## Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [pgAdmin](https://www.pgadmin.org/) - GUI tool for PostgreSQL management

## Support

For issues specific to ChainGuard AI database setup:
- Check the main [README.md](../README.md)
- Review service-specific documentation
- Open an issue on GitHub

---

**Last Updated**: January 2025
