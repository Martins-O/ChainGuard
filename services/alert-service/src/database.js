const { Pool } = require('pg');
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
    const createAlertsTable = `
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        alert_id VARCHAR(36) UNIQUE NOT NULL,
        tx_hash VARCHAR(66) NOT NULL,
        threat_score FLOAT NOT NULL,
        threat_level VARCHAR(20) NOT NULL,
        explanation TEXT,
        transaction_data JSONB,
        notification_channels JSONB,
        notification_sent BOOLEAN DEFAULT FALSE,
        acknowledged BOOLEAN DEFAULT FALSE,
        false_positive BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createAlertLogsTable = `
      CREATE TABLE IF NOT EXISTS alert_logs (
        id SERIAL PRIMARY KEY,
        alert_id VARCHAR(36) REFERENCES alerts(alert_id),
        channel VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        message TEXT,
        error TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_alerts_tx_hash ON alerts(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_alerts_threat_level ON alerts(threat_level);
      CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
      CREATE INDEX IF NOT EXISTS idx_alert_logs_alert_id ON alert_logs(alert_id);
    `;

    try {
      await this.pool.query(createAlertsTable);
      await this.pool.query(createAlertLogsTable);
      await this.pool.query(createIndexes);
      logger.info('Database tables created/verified');
    } catch (error) {
      logger.error('Failed to create database tables:', error);
      throw error;
    }
  }

  async createAlert(alertData) {
    const {
      alertId,
      txHash,
      threatScore,
      threatLevel,
      explanation,
      transactionData,
      notificationChannels
    } = alertData;

    const query = `
      INSERT INTO alerts (
        alert_id, tx_hash, threat_score, threat_level, explanation, 
        transaction_data, notification_channels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [
        alertId,
        txHash,
        threatScore,
        threatLevel,
        explanation,
        JSON.stringify(transactionData),
        JSON.stringify(notificationChannels)
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  async getAlert(alertId) {
    const query = 'SELECT * FROM alerts WHERE alert_id = $1';

    try {
      const result = await this.pool.query(query, [alertId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get alert:', error);
      throw error;
    }
  }

  async updateAlert(alertId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE alerts 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE alert_id = $1 
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [alertId, ...values]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update alert:', error);
      throw error;
    }
  }

  async logNotification(alertId, channel, status, message = null, error = null) {
    const query = `
      INSERT INTO alert_logs (alert_id, channel, status, message, error)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [alertId, channel, status, message, error]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to log notification:', error);
      throw error;
    }
  }

  async getAlertHistory(limit = 100, offset = 0, filters = {}) {
    let query = 'SELECT * FROM alerts';
    const params = [];
    let paramIndex = 1;

    const conditions = [];
    if (filters.threatLevel) {
      conditions.push(`threat_level = $${paramIndex++}`);
      params.push(filters.threatLevel);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }
    if (filters.acknowledged !== undefined) {
      conditions.push(`acknowledged = $${paramIndex++}`);
      params.push(filters.acknowledged);
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
      logger.error('Failed to get alert history:', error);
      throw error;
    }
  }

  async checkDuplicateAlert(txHash, timeWindowMinutes = 5) {
    const query = `
      SELECT COUNT(*) as count 
      FROM alerts 
      WHERE tx_hash = $1 AND created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
    `;

    try {
      const result = await this.pool.query(query, [txHash]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Failed to check duplicate alert:', error);
      throw error;
    }
  }

  async getStats() {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM alerts',
      critical: "SELECT COUNT(*) as count FROM alerts WHERE threat_level = 'CRITICAL'",
      high: "SELECT COUNT(*) as count FROM alerts WHERE threat_level = 'HIGH'",
      medium: "SELECT COUNT(*) as count FROM alerts WHERE threat_level = 'MEDIUM'",
      low: "SELECT COUNT(*) as count FROM alerts WHERE threat_level = 'LOW'",
      acknowledged: 'SELECT COUNT(*) as count FROM alerts WHERE acknowledged = true',
      falsePositives: 'SELECT COUNT(*) as count FROM alerts WHERE false_positive = true',
      today: "SELECT COUNT(*) as count FROM alerts WHERE DATE(created_at) = CURRENT_DATE"
    };

    try {
      const results = await Promise.all(
        Object.entries(queries).map(async ([key, query]) => {
          const result = await this.pool.query(query);
          return [key, parseInt(result.rows[0].count)];
        })
      );

      return Object.fromEntries(results);
    } catch (error) {
      logger.error('Failed to get alert stats:', error);
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