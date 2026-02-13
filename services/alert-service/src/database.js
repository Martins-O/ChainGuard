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
<<<<<<< HEAD
      const connectionString = process.env.DATABASE_URL || 
        'mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin';
      
      this.client = new MongoClient(connectionString, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 5000,
=======
      const mongoUrl = process.env.MONGODB_URL ||
        'mongodb://chainguard:chainguard_password@localhost:27017/chainguard';

      this.client = new MongoClient(mongoUrl, {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 2000,
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
      });

      await this.client.connect();
      this.db = this.client.db('chainguard');

      // Test connection
<<<<<<< HEAD
      await this.db.admin().ping();

      // Create collections and indexes
      await this.createCollections();
      
      logger.info('Database connected successfully');
=======
      await this.db.command({ ping: 1 });

      // Ensure indexes exist
      await this.createIndexes();

      logger.info('MongoDB connected successfully');
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

<<<<<<< HEAD
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
=======
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
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
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
<<<<<<< HEAD
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
=======
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

      return this._formatAlert(inserted);
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  async getAlert(alertId) {
    try {
<<<<<<< HEAD
      const alert = await this.db.collection('alerts').findOne({ alert_id: alertId });
      return alert ? this.formatAlert(alert) : null;
=======
      const alert = await this.db.collection('alerts').findOne({ alertId });
      return alert ? this._formatAlert(alert) : null;
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    } catch (error) {
      logger.error('Failed to get alert:', error);
      throw error;
    }
  }

  async updateAlert(alertId, updates) {
    try {
<<<<<<< HEAD
      const updateDoc = { ...updates, updated_at: new Date() };
      
      await this.db.collection('alerts').updateOne(
        { alert_id: alertId },
        { $set: updateDoc }
      );

      const alert = await this.db.collection('alerts').findOne({ alert_id: alertId });
      return alert ? this.formatAlert(alert) : null;
=======
      // Convert snake_case updates to camelCase for MongoDB
      const mongoUpdates = {};

      if (updates.notification_sent !== undefined) {
        mongoUpdates.notificationSent = updates.notification_sent;
      }
      if (updates.acknowledged !== undefined) {
        mongoUpdates.acknowledged = updates.acknowledged;
      }
      if (updates.false_positive !== undefined) {
        mongoUpdates.falsePositive = updates.false_positive;
      }
      if (updates.acknowledged_by !== undefined) {
        mongoUpdates.acknowledgedBy = updates.acknowledged_by ? {
          userId: new ObjectId(updates.acknowledged_by),
          username: 'alert_service'
        } : null;
      }
      if (updates.acknowledged_at !== undefined) {
        mongoUpdates.acknowledgedAt = updates.acknowledged_at;
      }

      mongoUpdates.updatedAt = new Date();

      const result = await this.db.collection('alerts').findOneAndUpdate(
        { alertId },
        { $set: mongoUpdates },
        { returnDocument: 'after' }
      );

      return result.value ? this._formatAlert(result.value) : null;
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    } catch (error) {
      logger.error('Failed to update alert:', error);
      throw error;
    }
  }

  async logNotification(alertId, channel, status, message = null, error = null) {
    try {
<<<<<<< HEAD
      const result = await this.db.collection('alert_logs').insertOne({
        alert_id: alertId,
=======
      const logDoc = {
        alertId,
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
        channel,
        status,
        message,
        error,
<<<<<<< HEAD
        sent_at: new Date()
      });

      const log = await this.db.collection('alert_logs').findOne({ _id: result.insertedId });
      return this.formatAlertLog(log);
=======
        sentAt: new Date()
      };

      const result = await this.db.collection('alert_logs').insertOne(logDoc);
      const inserted = await this.db.collection('alert_logs').findOne({ _id: result.insertedId });

      return this._formatAlertLog(inserted);
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    } catch (error) {
      logger.error('Failed to log notification:', error);
      throw error;
    }
  }

  async getAlertHistory(limit = 100, offset = 0, filters = {}) {
    try {
      const query = {};
<<<<<<< HEAD

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
=======

      if (filters.threatLevel) {
        query.threatLevel = filters.threatLevel;
      }
      if (filters.startDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = new Date(filters.endDate);
      }
      if (filters.acknowledged !== undefined) {
        query.acknowledged = filters.acknowledged;
      }

      const alerts = await this.db.collection('alerts')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return alerts.map(alert => this._formatAlert(alert));
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      throw error;
    }
  }

  async checkDuplicateAlert(txHash, timeWindowMinutes = 5) {
    try {
<<<<<<< HEAD
      const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      const count = await this.db.collection('alerts').countDocuments({
        tx_hash: txHash,
        created_at: { $gte: timeWindow }
      });
      
=======
      const timeWindowMs = timeWindowMinutes * 60 * 1000;
      const cutoffTime = new Date(Date.now() - timeWindowMs);

      const count = await this.db.collection('alerts').countDocuments({
        txHash,
        createdAt: { $gt: cutoffTime }
      });

>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
      return count > 0;
    } catch (error) {
      logger.error('Failed to check duplicate alert:', error);
      throw error;
    }
  }

  async getStats() {
    try {
<<<<<<< HEAD
=======
      const today = new Date();
      today.setHours(0, 0, 0, 0);

>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
      const [
        total,
        critical,
        high,
        medium,
        low,
        acknowledged,
        falsePositives,
<<<<<<< HEAD
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
=======
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
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
      ]);

      return {
        total,
        critical,
        high,
        medium,
        low,
        acknowledged,
        falsePositives,
<<<<<<< HEAD
        today
=======
        today: todayCount
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
      };
    } catch (error) {
      logger.error('Failed to get alert stats:', error);
      throw error;
    }
  }

<<<<<<< HEAD
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
=======
  // Formatting helper to convert MongoDB documents to API format
  _formatAlert(alert) {
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

  _formatAlertLog(log) {
    if (!log) return null;

    return {
      id: log._id.toString(),
      alert_id: log.alertId,
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
      channel: log.channel,
      status: log.status,
      message: log.message,
      error: log.error,
<<<<<<< HEAD
      sent_at: log.sent_at
=======
      sent_at: log.sentAt
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    };
  }

  async close() {
    if (this.client) {
      await this.client.close();
<<<<<<< HEAD
      logger.info('Database connection closed');
=======
      logger.info('MongoDB connection closed');
>>>>>>> cef979a9d3c0b7abcc524caf7fa6fdbb5feeaded
    }
  }
}

module.exports = Database;
