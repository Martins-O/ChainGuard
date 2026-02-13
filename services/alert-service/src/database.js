const { MongoClient, ObjectId } = require('mongodb');
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
    this.client = null;
    this.db = null;
  }

  async initialize() {
    try {
      const connectionString = process.env.DATABASE_URL || 
        'mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin';
      
      this.client = new MongoClient(connectionString, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 5000,
      });

      await this.client.connect();
      this.db = this.client.db('chainguard');

      // Test connection
      await this.db.admin().ping();

      // Create collections and indexes
      await this.createCollections();
      
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async createCollections() {
    try {
      const collections = ['alerts', 'alert_logs'];
      
      for (const collectionName of collections) {
        const collections = await this.db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          await this.db.createCollection(collectionName);
          logger.info(`Created collection: ${collectionName}`);
        }
      }

      await this.createIndexes();
      logger.info('Database collections and indexes created/verified');
    } catch (error) {
      logger.error('Failed to create collections:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      await this.db.collection('alerts').createIndexes([
        { key: { alert_id: 1 }, unique: true },
        { key: { tx_hash: 1 } },
        { key: { threat_level: 1 } },
        { key: { created_at: -1 } }
      ]);

      await this.db.collection('alert_logs').createIndexes([
        { key: { alert_id: 1 } },
        { key: { channel: 1 } },
        { key: { status: 1 } },
        { key: { sent_at: -1 } }
      ]);

      logger.info('Indexes created successfully');
    } catch (error) {
      logger.error('Failed to create indexes:', error);
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

    try {
      const result = await this.db.collection('alerts').insertOne({
        alert_id: alertId,
        tx_hash: txHash,
        threat_score: threatScore,
        threat_level: threatLevel,
        explanation,
        transaction_data: transactionData,
        notification_channels: notificationChannels,
        notification_sent: false,
        acknowledged: false,
        false_positive: false,
        created_at: new Date(),
        updated_at: new Date()
      });

      const alert = await this.db.collection('alerts').findOne({ _id: result.insertedId });
      return this.formatAlert(alert);
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  async getAlert(alertId) {
    try {
      const alert = await this.db.collection('alerts').findOne({ alert_id: alertId });
      return alert ? this.formatAlert(alert) : null;
    } catch (error) {
      logger.error('Failed to get alert:', error);
      throw error;
    }
  }

  async updateAlert(alertId, updates) {
    try {
      const updateDoc = { ...updates, updated_at: new Date() };
      
      await this.db.collection('alerts').updateOne(
        { alert_id: alertId },
        { $set: updateDoc }
      );

      const alert = await this.db.collection('alerts').findOne({ alert_id: alertId });
      return alert ? this.formatAlert(alert) : null;
    } catch (error) {
      logger.error('Failed to update alert:', error);
      throw error;
    }
  }

  async logNotification(alertId, channel, status, message = null, error = null) {
    try {
      const result = await this.db.collection('alert_logs').insertOne({
        alert_id: alertId,
        channel,
        status,
        message,
        error,
        sent_at: new Date()
      });

      const log = await this.db.collection('alert_logs').findOne({ _id: result.insertedId });
      return this.formatAlertLog(log);
    } catch (error) {
      logger.error('Failed to log notification:', error);
      throw error;
    }
  }

  async getAlertHistory(limit = 100, offset = 0, filters = {}) {
    try {
      const query = {};

    if (filters.threatLevel) {
        query.threat_level = filters.threatLevel;
    }
    if (filters.startDate) {
        query.created_at = { ...query.created_at, $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
        query.created_at = { ...query.created_at, $lte: new Date(filters.endDate) };
    }
    if (filters.acknowledged !== undefined) {
        query.acknowledged = filters.acknowledged;
      }

      const alerts = await this.db.collection('alerts')
        .find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(offset)
        .toArray();

      return alerts.map(a => this.formatAlert(a));
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      throw error;
    }
  }

  async checkDuplicateAlert(txHash, timeWindowMinutes = 5) {
    try {
      const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      const count = await this.db.collection('alerts').countDocuments({
        tx_hash: txHash,
        created_at: { $gte: timeWindow }
      });
      
      return count > 0;
    } catch (error) {
      logger.error('Failed to check duplicate alert:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const [
        total,
        critical,
        high,
        medium,
        low,
        acknowledged,
        falsePositives,
        today
      ] = await Promise.all([
        this.db.collection('alerts').countDocuments(),
        this.db.collection('alerts').countDocuments({ threat_level: 'CRITICAL' }),
        this.db.collection('alerts').countDocuments({ threat_level: 'HIGH' }),
        this.db.collection('alerts').countDocuments({ threat_level: 'MEDIUM' }),
        this.db.collection('alerts').countDocuments({ threat_level: 'LOW' }),
        this.db.collection('alerts').countDocuments({ acknowledged: true }),
        this.db.collection('alerts').countDocuments({ false_positive: true }),
        this.db.collection('alerts').countDocuments({
          created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        })
      ]);

      return {
        total,
        critical,
        high,
        medium,
        low,
        acknowledged,
        falsePositives,
        today
      };
    } catch (error) {
      logger.error('Failed to get alert stats:', error);
      throw error;
    }
  }

  formatAlert(alert) {
    return {
      id: alert._id.toString(),
      alert_id: alert.alert_id,
      tx_hash: alert.tx_hash,
      subnet_id: alert.subnet_id?.toString(),
      threat_score: alert.threat_score,
      threat_level: alert.threat_level,
      explanation: alert.explanation,
      transaction_data: alert.transaction_data,
      notification_channels: alert.notification_channels,
      notification_sent: alert.notification_sent,
      acknowledged: alert.acknowledged,
      false_positive: alert.false_positive,
      acknowledged_by: alert.acknowledged_by?.toString(),
      acknowledged_at: alert.acknowledged_at,
      created_at: alert.created_at,
      updated_at: alert.updated_at
    };
  }

  formatAlertLog(log) {
    return {
      id: log._id.toString(),
      alert_id: log.alert_id,
      channel: log.channel,
      status: log.status,
      message: log.message,
      error: log.error,
      sent_at: log.sent_at
    };
  }

  async close() {
    if (this.client) {
      await this.client.close();
      logger.info('Database connection closed');
    }
  }
}

module.exports = Database;
