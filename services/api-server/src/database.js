const { MongoClient, ObjectId } = require('mongodb');
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
    this.client = null;
    this.db = null;
  }

  async initialize() {
    try {
      const mongoUrl = process.env.MONGODB_URL ||
        'mongodb://chainguard:chainguard_password@localhost:27017/chainguard';

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
      // Users indexes
      await this.db.collection('users').createIndex({ username: 1 }, { unique: true });
      await this.db.collection('users').createIndex({ email: 1 }, { unique: true });

      // Subnets indexes
      await this.db.collection('subnets').createIndex({ chainId: 1 }, { unique: true });
      await this.db.collection('subnets').createIndex({ isActive: 1 });

      // Transactions indexes
      await this.db.collection('transactions').createIndex({ txHash: 1 }, { unique: true });
      await this.db.collection('transactions').createIndex({ 'subnet.subnetId': 1, blockNumber: -1 });
      await this.db.collection('transactions').createIndex({ fromAddress: 1 });
      await this.db.collection('transactions').createIndex({ toAddress: 1 });

      // Threat analyses indexes
      await this.db.collection('threat_analyses').createIndex({ txHash: 1 }, { unique: true });
      await this.db.collection('threat_analyses').createIndex({ 'subnet.subnetId': 1, threatLevel: 1 });

      // Alerts indexes
      await this.db.collection('alerts').createIndex({ alertId: 1 }, { unique: true });
      await this.db.collection('alerts').createIndex({ txHash: 1 });
      await this.db.collection('alerts').createIndex({ 'subnet.subnetId': 1, createdAt: -1 });
      await this.db.collection('alerts').createIndex({ threatLevel: 1 });

      logger.info('MongoDB indexes created/verified');
    } catch (error) {
      logger.warn('Some indexes may already exist:', error.message);
    }
  }

  // User management
  async createUser(userData) {
    const { username, email, password, role = 'user' } = userData;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await this.db.collection('users').insertOne({
        username,
        email,
        passwordHash,
        role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const user = await this.db.collection('users').findOne({ _id: result.insertedId });
      return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      };
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUserByUsername(username) {
    try {
      const user = await this.db.collection('users').findOne({ username });
      if (!user) return null;

      return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        password_hash: user.passwordHash,
        role: user.role,
        is_active: user.isActive,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      };
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

    try {
      const result = await this.db.collection('subnets').insertOne({
        name,
        chainId,
        rpcUrl,
        websocketUrl,
        description: description || '',
        isActive: true,
        monitoringEnabled: true,
        createdBy: createdBy ? {
          userId: new ObjectId(createdBy),
          username: 'api_user'  // Would need to fetch from users collection
        } : null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const subnet = await this.db.collection('subnets').findOne({ _id: result.insertedId });
      return this._formatSubnet(subnet);
    } catch (error) {
      logger.error('Failed to create subnet:', error);
      throw error;
    }
  }

  async getSubnets(limit = 100, offset = 0, filters = {}) {
    try {
      const query = {};

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.monitoringEnabled !== undefined) {
        query.monitoringEnabled = filters.monitoringEnabled;
      }

      const subnets = await this.db.collection('subnets')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return subnets.map(subnet => this._formatSubnet(subnet));
    } catch (error) {
      logger.error('Failed to get subnets:', error);
      throw error;
    }
  }

  async getSubnetById(id) {
    try {
      const subnet = await this.db.collection('subnets').findOne({ _id: new ObjectId(id) });
      return subnet ? this._formatSubnet(subnet) : null;
    } catch (error) {
      logger.error('Failed to get subnet:', error);
      throw error;
    }
  }

  async updateSubnet(id, updates) {
    try {
      // Convert snake_case to camelCase for MongoDB
      const mongoUpdates = {};
      if (updates.is_active !== undefined) mongoUpdates.isActive = updates.is_active;
      if (updates.monitoring_enabled !== undefined) mongoUpdates.monitoringEnabled = updates.monitoring_enabled;
      if (updates.name) mongoUpdates.name = updates.name;
      if (updates.description) mongoUpdates.description = updates.description;

      mongoUpdates.updatedAt = new Date();

      const result = await this.db.collection('subnets').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: mongoUpdates },
        { returnDocument: 'after' }
      );

      return result.value ? this._formatSubnet(result.value) : null;
    } catch (error) {
      logger.error('Failed to update subnet:', error);
      throw error;
    }
  }

  async deleteSubnet(id) {
    try {
      const result = await this.db.collection('subnets').findOneAndDelete({ _id: new ObjectId(id) });
      return result.value ? this._formatSubnet(result.value) : null;
    } catch (error) {
      logger.error('Failed to delete subnet:', error);
      throw error;
    }
  }

  // Transaction management
  async getTransactions(subnetId, limit = 100, offset = 0, filters = {}) {
    try {
      const query = { 'subnet.subnetId': new ObjectId(subnetId) };

      if (filters.fromAddress) {
        query.fromAddress = filters.fromAddress;
      }
      if (filters.toAddress) {
        query.toAddress = filters.toAddress;
      }
      if (filters.status !== undefined) {
        query.status = filters.status;
      }
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const transactions = await this.db.collection('transactions')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return transactions.map(tx => this._formatTransaction(tx));
    } catch (error) {
      logger.error('Failed to get transactions:', error);
      throw error;
    }
  }

  async getTransactionByHash(txHash) {
    try {
      const transaction = await this.db.collection('transactions').findOne({ txHash });
      return transaction ? this._formatTransaction(transaction) : null;
    } catch (error) {
      logger.error('Failed to get transaction:', error);
      throw error;
    }
  }

  // Alert management
  async getAlerts(subnetId, limit = 100, offset = 0, filters = {}) {
    try {
      const query = { 'subnet.subnetId': new ObjectId(subnetId) };

      if (filters.threatLevel) {
        query.threatLevel = filters.threatLevel;
      }
      if (filters.acknowledged !== undefined) {
        query.acknowledged = filters.acknowledged;
      }
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const alerts = await this.db.collection('alerts')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return alerts.map(alert => this._formatAlert(alert));
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId, userId) {
    try {
      const result = await this.db.collection('alerts').findOneAndUpdate(
        { _id: new ObjectId(alertId) },
        {
          $set: {
            acknowledged: true,
            acknowledgedBy: {
              userId: new ObjectId(userId),
              username: 'api_user'
            },
            acknowledgedAt: new Date(),
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      return result.value ? this._formatAlert(result.value) : null;
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  async markFalsePositive(alertId, userId) {
    try {
      const result = await this.db.collection('alerts').findOneAndUpdate(
        { _id: new ObjectId(alertId) },
        {
          $set: {
            falsePositive: true,
            acknowledged: true,
            acknowledgedBy: {
              userId: new ObjectId(userId),
              username: 'api_user'
            },
            acknowledgedAt: new Date(),
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      return result.value ? this._formatAlert(result.value) : null;
    } catch (error) {
      logger.error('Failed to mark alert as false positive:', error);
      throw error;
    }
  }

  // Statistics
  async getSubnetStats(subnetId) {
    try {
      const subnetObjectId = new ObjectId(subnetId);

      const [
        totalTransactions,
        successfulTransactions,
        totalThreats,
        threatsByLevel,
        totalAlerts,
        acknowledgedAlerts,
        falsePositives,
        avgThreatScore,
        todayTransactions,
        todayThreats,
        todayAlerts
      ] = await Promise.all([
        this.db.collection('transactions').countDocuments({ 'subnet.subnetId': subnetObjectId }),
        this.db.collection('transactions').countDocuments({ 'subnet.subnetId': subnetObjectId, status: true }),
        this.db.collection('threat_analyses').countDocuments({ 'subnet.subnetId': subnetObjectId }),
        this.db.collection('threat_analyses').aggregate([
          { $match: { 'subnet.subnetId': subnetObjectId } },
          { $group: { _id: '$threatLevel', count: { $sum: 1 } } }
        ]).toArray(),
        this.db.collection('alerts').countDocuments({ 'subnet.subnetId': subnetObjectId }),
        this.db.collection('alerts').countDocuments({ 'subnet.subnetId': subnetObjectId, acknowledged: true }),
        this.db.collection('alerts').countDocuments({ 'subnet.subnetId': subnetObjectId, falsePositive: true }),
        this.db.collection('threat_analyses').aggregate([
          { $match: { 'subnet.subnetId': subnetObjectId } },
          { $group: { _id: null, avg: { $avg: '$scores.final' } } }
        ]).toArray(),
        this.db.collection('transactions').countDocuments({
          'subnet.subnetId': subnetObjectId,
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }),
        this.db.collection('threat_analyses').countDocuments({
          'subnet.subnetId': subnetObjectId,
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }),
        this.db.collection('alerts').countDocuments({
          'subnet.subnetId': subnetObjectId,
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        })
      ]);

      // Convert threat levels to individual counts
      const threatLevels = {
        criticalThreats: 0,
        highThreats: 0,
        mediumThreats: 0,
        lowThreats: 0
      };

      threatsByLevel.forEach(item => {
        if (item._id === 'CRITICAL') threatLevels.criticalThreats = item.count;
        if (item._id === 'HIGH') threatLevels.highThreats = item.count;
        if (item._id === 'MEDIUM') threatLevels.mediumThreats = item.count;
        if (item._id === 'LOW') threatLevels.lowThreats = item.count;
      });

      return {
        totalTransactions,
        successfulTransactions,
        totalThreats,
        ...threatLevels,
        totalAlerts,
        acknowledgedAlerts,
        falsePositives,
        avgThreatScore: avgThreatScore[0]?.avg || 0,
        todayTransactions,
        todayThreats,
        todayAlerts
      };
    } catch (error) {
      logger.error('Failed to get subnet stats:', error);
      throw error;
    }
  }

  // Formatting helpers (convert MongoDB documents to PostgreSQL-like format for compatibility)
  _formatSubnet(subnet) {
    return {
      id: subnet._id.toString(),
      name: subnet.name,
      chain_id: subnet.chainId,
      rpc_url: subnet.rpcUrl,
      websocket_url: subnet.websocketUrl,
      description: subnet.description,
      is_active: subnet.isActive,
      monitoring_enabled: subnet.monitoringEnabled,
      created_by: subnet.createdBy?.userId?.toString() || null,
      created_at: subnet.createdAt,
      updated_at: subnet.updatedAt
    };
  }

  _formatTransaction(tx) {
    return {
      id: tx._id.toString(),
      tx_hash: tx.txHash,
      subnet_id: tx.subnet?.subnetId?.toString() || null,
      block_number: tx.blockNumber,
      transaction_index: tx.transactionIndex,
      from_address: tx.fromAddress,
      to_address: tx.toAddress,
      value: tx.value,
      gas_used: tx.gasUsed,
      gas_limit: tx.gasLimit,
      gas_price: tx.gasPrice,
      transaction_data: tx.transactionData,
      decoded_call: tx.decodedCall,
      logs: tx.logs,
      status: tx.status,
      created_at: tx.createdAt
    };
  }

  _formatAlert(alert) {
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

  async close() {
    if (this.client) {
      await this.client.close();
      logger.info('MongoDB connection closed');
    }
  }
}

module.exports = Database;
