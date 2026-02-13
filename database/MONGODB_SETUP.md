# MongoDB Setup Guide for ChainGuard AI

This guide provides comprehensive instructions for setting up and configuring MongoDB for the ChainGuard AI security monitoring platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [Configuration](#configuration)
5. [Connection Testing](#connection-testing)
6. [Backup and Restore](#backup-and-restore)
7. [Performance Tuning](#performance-tuning)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- MongoDB 6.0 or higher (or MongoDB 7.0 for latest features)
- Administrative access to MongoDB
- Basic knowledge of MongoDB and command line

## Installation

### macOS

```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community@7
brew services start mongodb-community@7
```

### Linux (Ubuntu/Debian)

```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Windows

1. Download MongoDB from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Run the installer and follow the setup wizard
3. MongoDB will be installed as a Windows service

### Docker (Recommended for Development)

```bash
# Pull MongoDB image
docker pull mongo:7

# Run MongoDB container
docker run --name chainguard-mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=chainguard \
  -e MONGO_INITDB_ROOT_PASSWORD=chainguard_password \
  -e MONGO_INITDB_DATABASE=chainguard \
  -p 27017:27017 \
  -d mongo:7

# Or use docker-compose (already configured in project root)
docker-compose up -d mongodb
```

## Database Setup

### Step 1: Access MongoDB

```bash
# Local MongoDB
mongosh

# Docker MongoDB
docker exec -it chainguard-mongodb mongosh -u chainguard -p chainguard_password --authenticationDatabase admin
```

### Step 2: Create Database and User

```javascript
// Connect to MongoDB
use admin
db.auth('chainguard', 'chainguard_password')

// Create database (switches to it)
use chainguard

// Create user with read/write permissions
db.createUser({
  user: 'chainguard',
  pwd: 'chainguard_password',
  roles: [
    { role: 'readWrite', db: 'chainguard' }
  ]
})
```

### Step 3: Verify Setup

```javascript
// List databases
show dbs

// Switch to database
use chainguard

// List collections
show collections

// Check user
db.getUsers()
```

## Configuration

### Connection String Format

```
mongodb://[username]:[password]@[host]:[port]/[database]?authSource=admin
```

**Example:**
```
mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL=mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin
DB_HOST=localhost
DB_PORT=27017
DB_NAME=chainguard
DB_USER=chainguard
DB_PASSWORD=chainguard_password

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### MongoDB Configuration File

Location:
- **macOS/Linux**: `/usr/local/etc/mongod.conf` or `/etc/mongod.conf`
- **Windows**: `C:\Program Files\MongoDB\Server\[version]\bin\mongod.cfg`
- **Docker**: Edit via `docker exec` or volume mount

Key settings for ChainGuard:

```yaml
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 0.0.0.0

security:
  authorization: enabled

operationProfiling:
  slowOpThresholdMs: 100
  mode: slowOp
```

## Automated Setup

### Quick Setup Script

```bash
# Navigate to database directory
cd database

# Make setup script executable
chmod +x setup.sh

# Run setup script
./setup.sh
```

The setup script will:
1. Verify MongoDB is running
2. Create collections if they don't exist
3. Create all necessary indexes
4. Insert default admin user
5. Verify setup

## Connection Testing

### Using mongosh

```bash
mongosh "mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin"
```

### Using Node.js

```javascript
const { MongoClient } = require('mongodb');

const client = new MongoClient(
  'mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin'
);

async function testConnection() {
  try {
    await client.connect();
    await client.db('chainguard').admin().ping();
    console.log('Connected successfully');
  } finally {
    await client.close();
  }
}

testConnection();
```

### Using Python

```python
from pymongo import MongoClient

client = MongoClient(
    "mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin"
)

# Test connection
client.admin.command('ping')
print("Connected successfully")
client.close()
```

## Backup and Restore

### Create Backup

```bash
# Full database backup
mongodump --uri="mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin" --out=backup_$(date +%Y%m%d)

# Backup specific collection
mongodump --uri="mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin" --collection=transactions --out=backup_transactions
```

### Restore Backup

```bash
# Restore full database
mongorestore --uri="mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin" backup_20240101/chainguard

# Restore specific collection
mongorestore --uri="mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin" --collection=transactions backup_transactions/chainguard/transactions.bson
```

### Automated Backups

Create a backup script (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/chainguard_$DATE"

mongodump --uri="mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin" --out="$BACKUP_PATH"

# Compress backup
tar -czf "$BACKUP_PATH.tar.gz" "$BACKUP_PATH"
rm -rf "$BACKUP_PATH"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "chainguard_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_PATH.tar.gz"
```

Add to crontab for daily backups at 2 AM:

```bash
crontab -e
# Add this line:
0 2 * * * /path/to/backup.sh
```

## Performance Tuning

### Index Management

```javascript
// View all indexes
db.collection.getIndexes()

// Create index
db.transactions.createIndex({ tx_hash: 1 }, { unique: true })

// Drop index
db.transactions.dropIndex({ tx_hash: 1 })

// Analyze query performance
db.transactions.find({ tx_hash: "0x..." }).explain("executionStats")
```

### Monitor Performance

```javascript
// Enable profiling
db.setProfilingLevel(1, { slowms: 100 })

// View slow queries
db.system.profile.find().sort({ ts: -1 }).limit(10).pretty()

// View collection stats
db.transactions.stats()
```

### Connection Pooling

MongoDB drivers handle connection pooling automatically. Configure in application:

```javascript
const client = new MongoClient(connectionString, {
  maxPoolSize: 20,
  minPoolSize: 5,
  maxIdleTimeMS: 30000
});
```

## Troubleshooting

### Connection Refused

**Problem**: `MongoServerError: connection refused`

**Solutions**:
1. Check if MongoDB is running:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status mongod
   
   # Docker
   docker ps | grep mongo
   ```

2. Verify port is not blocked:
   ```bash
   netstat -an | grep 27017
   ```

3. Check MongoDB logs:
   ```bash
   # macOS
   tail -f /usr/local/var/log/mongodb/mongo.log
   
   # Linux
   tail -f /var/log/mongodb/mongod.log
   ```

### Authentication Failed

**Problem**: `MongoServerError: Authentication failed`

**Solutions**:
1. Verify credentials:
   ```javascript
   mongosh -u chainguard -p chainguard_password --authenticationDatabase admin
   ```

2. Check user exists:
   ```javascript
   use admin
   db.getUsers()
   ```

3. Recreate user if needed:
   ```javascript
   use chainguard
   db.dropUser('chainguard')
   db.createUser({
     user: 'chainguard',
     pwd: 'chainguard_password',
     roles: [{ role: 'readWrite', db: 'chainguard' }]
   })
   ```

### Database Does Not Exist

**Problem**: Database not found

**Solution**:
```javascript
// MongoDB creates databases automatically on first write
use chainguard
db.test.insertOne({ test: true })
```

### High Memory Usage

**Problem**: MongoDB consuming too much memory

**Solutions**:
1. Set WiredTiger cache size in `mongod.conf`:
   ```yaml
   storage:
     wiredTiger:
       engineConfig:
         cacheSizeGB: 2  # Adjust based on available RAM
   ```

2. Monitor with:
   ```javascript
   db.serverStatus().mem
   ```

### Slow Queries

**Problem**: Queries taking too long

**Solutions**:
1. Check indexes:
   ```javascript
   db.collection.getIndexes()
   ```

2. Use explain to analyze:
   ```javascript
   db.collection.find(query).explain("executionStats")
   ```

3. Create missing indexes
4. Optimize query patterns

## Security Best Practices

1. **Enable Authentication**: Always enable MongoDB authentication
2. **Use Strong Passwords**: Use complex passwords for database users
3. **Network Security**: Restrict MongoDB to localhost or specific IPs
4. **Encryption**: Enable encryption at rest and in transit
5. **Regular Updates**: Keep MongoDB updated
6. **Backup Encryption**: Encrypt database backups
7. **Role-Based Access**: Use least privilege principle
8. **Audit Logging**: Enable MongoDB audit logging

## Additional Resources

- [MongoDB Official Documentation](https://docs.mongodb.com/)
- [MongoDB Performance Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)
- [MongoDB Compass](https://www.mongodb.com/products/compass) - GUI tool for MongoDB management

## Support

For issues specific to ChainGuard AI database setup:
- Check the main [README.md](../README.md)
- Review service-specific documentation
- Open an issue on GitHub

---

**Last Updated**: January 2025
