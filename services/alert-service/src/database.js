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
      const mongoUrl = process.env.MONGODB_URL ||
        'mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin';

      this.client = new MongoClient(mongoUrl, {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 2000,
      });

      await this.client.connect();
      this.db = this.client.db('chainguard');

      // Test connection
      await this.db.command({ ping: 1 });

      // Ensure indexes exist
      await this.createIndexes();

      logger.info('MongoDB connected successfully');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Alerts indexes
      await this.db.collection('alerts').createIndex({ alertId: 1 }, { unique: true });
      await this.db.collection('alerts').createIndex({ txHash: 1 });
      await this.db.collection('alerts').createIndex({ threatLevel: 1 });
      await this.db.collection('alerts').createIndex({ createdAt: -1 });
      await this.db.collection('alerts').createIndex({ acknowledged: 1 });
      await this.db.collection('alerts').createIndex({ falsePositive: 1 });

      // Alert logs indexes
      await this.db.collection('alert_logs').createIndex({ alertId: 1 });
      await this.db.collection('alert_logs').createIndex({ channel: 1 });
      await this.db.collection('alert_logs').createIndex({ status: 1 });
      await this.db.collection('alert_logs').createIndex({ sentAt: -1 });

      // TTL index for alert_logs (expire after 30 days)
      await this.db.collection('alert_logs').createIndex(
        { sentAt: 1 },
        { expireAfterSeconds: 2592000 }
      );

      logger.info('MongoDB indexes created/verified');
    } catch (error) {
      logger.warn('Some indexes may already exist:', error.message);
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
      notificationChannels,
      subnetId,
      subnetChainId
    } = alertData;

    try {
      const alertDoc = {
        alertId,
        txHash,
        threatScore,
        threatLevel,
        explanation,
        transactionData,
        notificationChannels,
        subnet: subnetId ? {
          subnetId: new ObjectId(subnetId),
          chainId: subnetChainId || 'unknown'
        } : null,
        notificationSent: false,
        acknowledged: false,
        falsePositive: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.db.collection('alerts').insertOne(alertDoc);
      const inserted = await this.db.collection('alerts').findOne({ _id: result.insertedId });

      return this.formatAlert(inserted);
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  async getAlert(alertId) {
    try {
      const alert = await this.db.collection('alerts').findOne({ alertId });
      return alert ? this.formatAlert(alert) : null;
    } catch (error) {
      logger.error('Failed to get alert:', error);
      throw error;
    }
  }

  async updateAlert(alertId, updates) {
    try {
      // Convert snake_case updates to camelCase for MongoDB if needed
      const mongoUpdates = {};

      if (updates.notification_sent !== undefined) mongoUpdates.notificationSent = updates.notification_sent;
      if (updates.notificationSent !== undefined) mongoUpdates.notificationSent = updates.notificationSent;

      if (updates.acknowledged !== undefined) mongoUpdates.acknowledged = updates.acknowledged;

      if (updates.false_positive !== undefined) mongoUpdates.falsePositive = updates.false_positive;
      if (updates.falsePositive !== undefined) mongoUpdates.falsePositive = updates.falsePositive;

      if (updates.acknowledged_by !== undefined) {
        mongoUpdates.acknowledgedBy = updates.acknowledged_by ? {
          userId: new ObjectId(updates.acknowledged_by),
          at: new Date()
        } : null;
      }
      if (updates.acknowledgedBy !== undefined) mongoUpdates.acknowledgedBy = updates.acknowledgedBy;

      if (updates.acknowledged_at !== undefined) mongoUpdates.acknowledgedAt = updates.acknowledged_at;
      if (updates.acknowledgedAt !== undefined) mongoUpdates.acknowledgedAt = updates.acknowledgedAt;

      mongoUpdates.updatedAt = new Date();

      const result = await this.db.collection('alerts').findOneAndUpdate(
        { alertId },
        { $set: mongoUpdates },
        { returnDocument: 'after' }
      );

      const updated = result.value || result;
      return updated ? this.formatAlert(updated) : null;
    } catch (error) {
      logger.error('Failed to update alert:', error);
      throw error;
    }
  }

  async logNotification(alertId, channel, status, message = null, error = null) {
    try {
      const logDoc = {
        alertId,
        channel,
        status,
        message,
        error,
        sentAt: new Date()
      };

      const result = await this.db.collection('alert_logs').insertOne(logDoc);
      const inserted = await this.db.collection('alert_logs').findOne({ _id: result.insertedId });

      return this.formatAlertLog(inserted);
    } catch (error) {
      logger.error('Failed to log notification:', error);
      throw error;
    }
  }

  async getAlertHistory(limit = 100, offset = 0, filters = {}) {
    try {
      const query = {};

      if (filters.threatLevel) query.threatLevel = filters.threatLevel;

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      if (filters.acknowledged !== undefined) query.acknowledged = filters.acknowledged;

      const alerts = await this.db.collection('alerts')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return alerts.map(alert => this.formatAlert(alert));
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      throw error;
    }
  }

  async checkDuplicateAlert(txHash, timeWindowMinutes = 5) {
    try {
      const timeWindowMs = timeWindowMinutes * 60 * 1000;
      const cutoffTime = new Date(Date.now() - timeWindowMs);

      const count = await this.db.collection('alerts').countDocuments({
        txHash,
        createdAt: { $gt: cutoffTime }
      });

      return count > 0;
    } catch (error) {
      logger.error('Failed to check duplicate alert:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        total,
        critical,
        high,
        medium,
        low,
        acknowledged,
        falsePositives,
        todayCount
      ] = await Promise.all([
        this.db.collection('alerts').countDocuments({}),
        this.db.collection('alerts').countDocuments({ threatLevel: 'CRITICAL' }),
        this.db.collection('alerts').countDocuments({ threatLevel: 'HIGH' }),
        this.db.collection('alerts').countDocuments({ threatLevel: 'MEDIUM' }),
        this.db.collection('alerts').countDocuments({ threatLevel: 'LOW' }),
        this.db.collection('alerts').countDocuments({ acknowledged: true }),
        this.db.collection('alerts').countDocuments({ falsePositive: true }),
        this.db.collection('alerts').countDocuments({ createdAt: { $gte: today } })
      ]);

      return {
        total,
        critical,
        high,
        medium,
        low,
        acknowledged,
        false_positives: falsePositives,
        today: todayCount
      };
    } catch (error) {
      logger.error('Failed to get alert stats:', error);
      throw error;
    }
  }

  formatAlert(alert) {
    if (!alert) return null;

    return {
      id: alert._id.toString(),
      alert_id: alert.alertId,
      tx_hash: alert.txHash,
      subnet_id: alert.subnet?.subnetId?.toString() || null,
      threat_score: alert.threatScore,
      threat_level: alert.threatLevel,
      explanation: alert.explanation,
      transaction_data: alert.transactionData,
      notification_channels: alert.notificationChannels,
      notification_sent: alert.notificationSent,
      acknowledged: alert.acknowledged,
      false_positive: alert.falsePositive,
      acknowledged_by: alert.acknowledgedBy?.userId?.toString() || null,
      acknowledged_at: alert.acknowledgedAt,
      created_at: alert.createdAt,
      updated_at: alert.updatedAt
    };
  }

  formatAlertLog(log) {
    if (!log) return null;

    return {
      id: log._id.toString(),
      alert_id: log.alertId,
      channel: log.channel,
      status: log.status,
      message: log.message,
      error: log.error,
      sent_at: log.sentAt
    };
  }

  async close() {
    if (this.client) {
      await this.client.close();
      logger.info('MongoDB connection closed');
    }
  }
}

module.exports = Database;
