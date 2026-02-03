const redis = require('redis');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');

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

class AlertProcessor {
  constructor(database, notificationService) {
    this.database = database;
    this.notificationService = notificationService;
    this.redisClient = null;
    this.processing = false;
    this.deduplicationWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.recentAlerts = new Map(); // For in-memory deduplication
  }

  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = redis.createClient({ url: redisUrl });
      
      this.redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
      });

      this.redisClient.on('connect', () => {
        logger.info('Connected to Redis');
      });

      await this.redisClient.connect();
      logger.info('Alert processor initialized');
    } catch (error) {
      logger.error('Failed to initialize alert processor:', error);
      throw error;
    }
  }

  async startProcessing() {
    if (this.processing) {
      logger.warn('Alert processing already started');
      return;
    }

    this.processing = true;
    logger.info('Starting alert processing...');

    while (this.processing) {
      try {
        // Get alert from Redis queue
        const alertData = await this.redisClient.brPop('alerts', 5);
        
        if (alertData) {
          const alert = JSON.parse(alertData.element);
          await this.processAlert(alert);
        }
      } catch (error) {
        logger.error('Error processing alert:', error);
        // Brief pause before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async processAlert(alertData) {
    try {
      logger.info(`Processing alert for transaction: ${alertData.tx_hash}`);

      // Check for duplicates
      if (await this.isDuplicate(alertData)) {
        logger.info(`Duplicate alert detected for transaction: ${alertData.tx_hash}`);
        return;
      }

      // Determine notification channels based on threat level
      const channels = this.getNotificationChannels(alertData.level);

      // Create alert record
      const alertRecord = await this.database.createAlert({
        alertId: uuidv4(),
        txHash: alertData.tx_hash,
        threatScore: alertData.score,
        threatLevel: alertData.level,
        explanation: alertData.explanation,
        transactionData: alertData.transaction,
        notificationChannels: channels
      });

      // Send notifications
      const notificationResults = await this.notificationService.sendNotification(
        {
          alertId: alertRecord.alert_id,
          txHash: alertRecord.tx_hash,
          threatScore: alertRecord.threat_score,
          threatLevel: alertRecord.threat_level,
          explanation: alertRecord.explanation,
          createdAt: alertRecord.created_at
        },
        channels
      );

      // Log notification results
      await this.logNotificationResults(alertRecord.alert_id, notificationResults);

      // Update alert record with notification status
      const allSuccessful = notificationResults.every(result => result.success);
      await this.database.updateAlert(alertRecord.alert_id, {
        notification_sent: allSuccessful
      });

      // Add to recent alerts for deduplication
      this.addToRecentAlerts(alertData.tx_hash);

      logger.info(`Alert processed successfully: ${alertRecord.alert_id}`);

    } catch (error) {
      logger.error(`Failed to process alert for ${alertData.tx_hash}:`, error);
      throw error;
    }
  }

  async isDuplicate(alertData) {
    const txHash = alertData.tx_hash;

    // Check in-memory cache first
    if (this.recentAlerts.has(txHash)) {
      const lastAlertTime = this.recentAlerts.get(txHash);
      if (Date.now() - lastAlertTime < this.deduplicationWindow) {
        return true;
      }
    }

    // Check database for recent alerts
    try {
      return await this.database.checkDuplicateAlert(txHash, 5);
    } catch (error) {
      logger.error('Error checking duplicate alert:', error);
      return false;
    }
  }

  addToRecentAlerts(txHash) {
    this.recentAlerts.set(txHash, Date.now());
    
    // Clean up old entries periodically
    if (this.recentAlerts.size > 1000) {
      const cutoff = Date.now() - this.deduplicationWindow;
      for (const [hash, time] of this.recentAlerts.entries()) {
        if (time < cutoff) {
          this.recentAlerts.delete(hash);
        }
      }
    }
  }

  getNotificationChannels(threatLevel) {
    switch (threatLevel) {
      case 'CRITICAL':
        return ['slack', 'email', 'sms'];
      case 'HIGH':
        return ['slack', 'email'];
      case 'MEDIUM':
        return ['slack'];
      case 'LOW':
        return []; // Log only
      default:
        return [];
    }
  }

  async logNotificationResults(alertId, results) {
    for (const result of results) {
      try {
        await this.database.logNotification(
          alertId,
          result.channel,
          result.success ? 'sent' : 'failed',
          result.success ? 'Notification sent successfully' : null,
          result.success ? null : result.error
        );
      } catch (error) {
        logger.error(`Failed to log notification result for ${result.channel}:`, error);
      }
    }
  }

  async acknowledgeAlert(alertId, userId = 'system') {
    try {
      const alert = await this.database.getAlert(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      const updatedAlert = await this.database.updateAlert(alertId, {
        acknowledged: true
      });

      logger.info(`Alert ${alertId} acknowledged by ${userId}`);
      return updatedAlert;
    } catch (error) {
      logger.error(`Failed to acknowledge alert ${alertId}:`, error);
      throw error;
    }
  }

  async markFalsePositive(alertId, userId = 'system') {
    try {
      const alert = await this.database.getAlert(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      const updatedAlert = await this.database.updateAlert(alertId, {
        false_positive: true,
        acknowledged: true
      });

      // Log this for ML model improvement
      logger.info(`Alert ${alertId} marked as false positive by ${userId}`);
      return updatedAlert;
    } catch (error) {
      logger.error(`Failed to mark alert ${alertId} as false positive:`, error);
      throw error;
    }
  }

  async getAlertStats() {
    try {
      return await this.database.getStats();
    } catch (error) {
      logger.error('Failed to get alert stats:', error);
      throw error;
    }
  }

  async getQueueLength() {
    try {
      return await this.redisClient.lLen('alerts');
    } catch (error) {
      logger.error('Failed to get queue length:', error);
      return 0;
    }
  }

  stopProcessing() {
    this.processing = false;
    logger.info('Alert processing stopped');
  }

  async cleanup() {
    this.stopProcessing();
    
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    logger.info('Alert processor cleaned up');
  }
}

module.exports = AlertProcessor;