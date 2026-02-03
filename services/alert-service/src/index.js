require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');

const Database = require('./database');
const NotificationService = require('./notificationService');
const AlertProcessor = require('./alertProcessor');

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize services
let database, notificationService, alertProcessor;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const queueLength = alertProcessor ? await alertProcessor.getQueueLength() : 0;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queueLength,
      services: {
        database: database ? 'connected' : 'disconnected',
        notification: notificationService ? 'initialized' : 'not_initialized',
        processor: alertProcessor ? 'running' : 'stopped'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get alert history
app.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const filters = {
      threatLevel: req.query.threatLevel,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      acknowledged: req.query.acknowledged === 'true' ? true : (req.query.acknowledged === 'false' ? false : undefined)
    };

    const alerts = await database.getAlertHistory(limit, offset, filters);
    res.json({
      success: true,
      data: alerts,
      pagination: {
        limit,
        offset,
        total: alerts.length
      }
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get alert details
app.get('/alerts/:alertId', async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const alert = await database.getAlert(alertId);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Acknowledge alert
app.patch('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const userId = req.body.userId || 'api_user';
    
    const alert = await alertProcessor.acknowledgeAlert(alertId, userId);
    
    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mark as false positive
app.post('/alerts/:alertId/false-positive', async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const userId = req.body.userId || 'api_user';
    
    const alert = await alertProcessor.markFalsePositive(alertId, userId);
    
    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error marking false positive:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get alert statistics
app.get('/stats', async (req, res) => {
  try {
    const stats = await alertProcessor.getAlertStats();
    const queueLength = await alertProcessor.getQueueLength();
    
    res.json({
      success: true,
      data: {
        ...stats,
        queueLength
      }
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test notification
app.post('/test-notification', async (req, res) => {
  try {
    const channel = req.body.channel;
    if (!channel) {
      return res.status(400).json({
        success: false,
        error: 'Channel is required'
      });
    }

    const result = await notificationService.testNotification(channel);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error testing notification:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const stats = await alertProcessor.getAlertStats();
    const queueLength = await alertProcessor.getQueueLength();
    
    // Prometheus-style metrics
    const metrics = [
      `# HELP chainguard_alerts_total Total number of alerts`,
      `# TYPE chainguard_alerts_total counter`,
      `chainguard_alerts_total ${stats.total}`,
      '',
      `# HELP chainguard_alerts_by_level Number of alerts by threat level`,
      `# TYPE chainguard_alerts_by_level gauge`,
      `chainguard_alerts_by_level{level="critical"} ${stats.critical}`,
      `chainguard_alerts_by_level{level="high"} ${stats.high}`,
      `chainguard_alerts_by_level{level="medium"} ${stats.medium}`,
      `chainguard_alerts_by_level{level="low"} ${stats.low}`,
      '',
      `# HELP chainguard_alerts_acknowledged Number of acknowledged alerts`,
      `# TYPE chainguard_alerts_acknowledged gauge`,
      `chainguard_alerts_acknowledged ${stats.acknowledged}`,
      '',
      `# HELP chainguard_alerts_false_positives Number of false positive alerts`,
      `# TYPE chainguard_alerts_false_positives gauge`,
      `chainguard_alerts_false_positives ${stats.falsePositives}`,
      '',
      `# HELP chainguard_queue_length Current alert queue length`,
      `# TYPE chainguard_queue_length gauge`,
      `chainguard_queue_length ${queueLength}`
    ];

    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ChainGuard Alert Service',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  if (alertProcessor) {
    await alertProcessor.cleanup();
  }
  
  if (database) {
    await database.close();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  
  if (alertProcessor) {
    await alertProcessor.cleanup();
  }
  
  if (database) {
    await database.close();
  }
  
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database
    database = new Database();
    await database.initialize();
    
    // Initialize notification service
    notificationService = new NotificationService();
    
    // Initialize alert processor
    alertProcessor = new AlertProcessor(database, notificationService);
    await alertProcessor.initialize();
    
    // Start alert processing in background
    alertProcessor.startProcessing();
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`ChainGuard Alert Service started on port ${PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();