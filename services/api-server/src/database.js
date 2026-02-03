const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class Database {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      const connectionString = process.env.DATABASE_URL || 
        'postgresql://chainguard:chainguard_password@localhost:5432/chainguard';
      
      this.pool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Create tables if they don't exist
      await this.createTables();
      
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createSubnetsTable = `
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
    `;

    const createTransactionsTable = `
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
    `;

    const createThreatAnalysesTable = `
      CREATE TABLE IF NOT EXISTS threat_analyses (
        id SERIAL PRIMARY KEY,
        tx_hash VARCHAR(66) UNIQUE NOT NULL,
        subnet_id INTEGER REFERENCES subnets(id),
        signature_score FLOAT,
        anomaly_score FLOAT,
        behavioral_score FLOAT,
        final_score FLOAT NOT NULL,
        threat_level VARCHAR(20) NOT NULL,
        explanation TEXT,
        raw_transaction JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createAlertsTable = `
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        alert_id VARCHAR(36) UNIQUE NOT NULL,
        tx_hash VARCHAR(66) NOT NULL,
        subnet_id INTEGER REFERENCES subnets(id),
        threat_score FLOAT NOT NULL,
        threat_level VARCHAR(20) NOT NULL,
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
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_subnets_chain_id ON subnets(chain_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_transactions_subnet_id ON transactions(subnet_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
      CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
      CREATE INDEX IF NOT EXISTS idx_transactions_block_number ON transactions(block_number);
      CREATE INDEX IF NOT EXISTS idx_threat_analyses_tx_hash ON threat_analyses(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_threat_analyses_subnet_id ON threat_analyses(subnet_id);
      CREATE INDEX IF NOT EXISTS idx_threat_analyses_threat_level ON threat_analyses(threat_level);
      CREATE INDEX IF NOT EXISTS idx_alerts_tx_hash ON alerts(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_alerts_subnet_id ON alerts(subnet_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_threat_level ON alerts(threat_level);
      CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
    `;

    try {
      await this.pool.query(createUsersTable);
      await this.pool.query(createSubnetsTable);
      await this.pool.query(createTransactionsTable);
      await this.pool.query(createThreatAnalysesTable);
      await this.pool.query(createAlertsTable);
      await this.pool.query(createIndexes);
      logger.info('Database tables created/verified');
    } catch (error) {
      logger.error('Failed to create database tables:', error);
      throw error;
    }
  }

  // User management
  async createUser(userData) {
    const { username, email, password, role = 'user' } = userData;
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, role, created_at;
    `;

    try {
      const result = await this.pool.query(query, [username, email, passwordHash, role]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUserByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';

    try {
      const result = await this.pool.query(query, [username]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get user:', error);
      throw error;
    }
  }

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  generateToken(user) {
    return jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '24h' }
    );
  }

  // Subnet management
  async createSubnet(subnetData) {
    const { name, chainId, rpcUrl, websocketUrl, description, createdBy } = subnetData;

    const query = `
      INSERT INTO subnets (name, chain_id, rpc_url, websocket_url, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [name, chainId, rpcUrl, websocketUrl, description, createdBy]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create subnet:', error);
      throw error;
    }
  }

  async getSubnets(limit = 100, offset = 0, filters = {}) {
    let query = 'SELECT * FROM subnets';
    const params = [];
    let paramIndex = 1;

    const conditions = [];
    if (filters.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(filters.isActive);
    }
    if (filters.monitoringEnabled !== undefined) {
      conditions.push(`monitoring_enabled = $${paramIndex++}`);
      params.push(filters.monitoringEnabled);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get subnets:', error);
      throw error;
    }
  }

  async getSubnetById(id) {
    const query = 'SELECT * FROM subnets WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get subnet:', error);
      throw error;
    }
  }

  async updateSubnet(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE subnets 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [id, ...values]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update subnet:', error);
      throw error;
    }
  }

  async deleteSubnet(id) {
    const query = 'DELETE FROM subnets WHERE id = $1 RETURNING *';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to delete subnet:', error);
      throw error;
    }
  }

  // Transaction management
  async getTransactions(subnetId, limit = 100, offset = 0, filters = {}) {
    let query = 'SELECT * FROM transactions WHERE subnet_id = $1';
    const params = [subnetId];
    let paramIndex = 2;

    const conditions = [];
    if (filters.fromAddress) {
      conditions.push(`from_address = $${paramIndex++}`);
      params.push(filters.fromAddress);
    }
    if (filters.toAddress) {
      conditions.push(`to_address = $${paramIndex++}`);
      params.push(filters.toAddress);
    }
    if (filters.status !== undefined) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get transactions:', error);
      throw error;
    }
  }

  async getTransactionByHash(txHash) {
    const query = 'SELECT * FROM transactions WHERE tx_hash = $1';

    try {
      const result = await this.pool.query(query, [txHash]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get transaction:', error);
      throw error;
    }
  }

  // Alert management
  async getAlerts(subnetId, limit = 100, offset = 0, filters = {}) {
    let query = 'SELECT * FROM alerts WHERE subnet_id = $1';
    const params = [subnetId];
    let paramIndex = 2;

    const conditions = [];
    if (filters.threatLevel) {
      conditions.push(`threat_level = $${paramIndex++}`);
      params.push(filters.threatLevel);
    }
    if (filters.acknowledged !== undefined) {
      conditions.push(`acknowledged = $${paramIndex++}`);
      params.push(filters.acknowledged);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId, userId) {
    const query = `
      UPDATE alerts 
      SET acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [alertId, userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  async markFalsePositive(alertId, userId) {
    const query = `
      UPDATE alerts 
      SET false_positive = TRUE, acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [alertId, userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to mark alert as false positive:', error);
      throw error;
    }
  }

  // Statistics
  async getSubnetStats(subnetId) {
    const queries = {
      totalTransactions: 'SELECT COUNT(*) as count FROM transactions WHERE subnet_id = $1',
      successfulTransactions: 'SELECT COUNT(*) as count FROM transactions WHERE subnet_id = $1 AND status = true',
      totalThreats: 'SELECT COUNT(*) as count FROM threat_analyses WHERE subnet_id = $1',
      criticalThreats: "SELECT COUNT(*) as count FROM threat_analyses WHERE subnet_id = $1 AND threat_level = 'CRITICAL'",
      highThreats: "SELECT COUNT(*) as count FROM threat_analyses WHERE subnet_id = $1 AND threat_level = 'HIGH'",
      mediumThreats: "SELECT COUNT(*) as count FROM threat_analyses WHERE subnet_id = $1 AND threat_level = 'MEDIUM'",
      lowThreats: "SELECT COUNT(*) as count FROM threat_analyses WHERE subnet_id = $1 AND threat_level = 'LOW'",
      totalAlerts: 'SELECT COUNT(*) as count FROM alerts WHERE subnet_id = $1',
      acknowledgedAlerts: 'SELECT COUNT(*) as count FROM alerts WHERE subnet_id = $1 AND acknowledged = true',
      falsePositives: 'SELECT COUNT(*) as count FROM alerts WHERE subnet_id = $1 AND false_positive = true',
      avgThreatScore: 'SELECT AVG(final_score) as avg FROM threat_analyses WHERE subnet_id = $1',
      todayTransactions: "SELECT COUNT(*) as count FROM transactions WHERE subnet_id = $1 AND DATE(created_at) = CURRENT_DATE",
      todayThreats: "SELECT COUNT(*) as count FROM threat_analyses WHERE subnet_id = $1 AND DATE(created_at) = CURRENT_DATE",
      todayAlerts: "SELECT COUNT(*) as count FROM alerts WHERE subnet_id = $1 AND DATE(created_at) = CURRENT_DATE"
    };

    try {
      const results = await Promise.all(
        Object.entries(queries).map(async ([key, query]) => {
          const result = await this.pool.query(query, [subnetId]);
          const value = result.rows[0].count;
          return [key, key.includes('Score') ? parseFloat(value) : parseInt(value)];
        })
      );

      return Object.fromEntries(results);
    } catch (error) {
      logger.error('Failed to get subnet stats:', error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection closed');
    }
  }
}

module.exports = Database;