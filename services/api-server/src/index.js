require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const Database = require('./database');
const limits = require('./middleware/rateLimiting');

// Import routes
const authRoutes = require('./routes/auth');
const subnetRoutes = require('./routes/subnets');

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
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
app.use(limits.general);

// Store database instance in app locals
app.locals.database = null;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const db = app.locals.database;
    let dbStatus = 'disconnected';
    if (db) {
      try {
        await db.client.db().command({ ping: 1 });
        dbStatus = 'connected';
      } catch (error) {
        dbStatus = 'error';
      }
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: 'running'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Swagger UI setup
try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../../swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ChainGuard AI API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true
    }
  }));
  logger.info('Swagger UI available at /api-docs');
} catch (error) {
  logger.warn('Failed to load Swagger documentation:', error.message);
}

// API routes
app.use('/auth', authRoutes);
app.use('/subnets', subnetRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ChainGuard API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/auth',
      subnets: '/subnets',
      transactions: '/transactions',
      alerts: '/alerts',
      stats: '/stats',
      health: '/health',
      apiDocs: '/api-docs'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
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

  if (app.locals.database) {
    await app.locals.database.close();
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  if (app.locals.database) {
    await app.locals.database.close();
  }

  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database
    const database = new Database();
    await database.initialize();
    app.locals.database = database;

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`ChainGuard API Server started on port ${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();