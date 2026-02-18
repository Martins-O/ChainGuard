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
        'mongodb://chainguard:chainguard_password@localhost:27018/chainguard?authSource=admin';

      this.client = new MongoClient(mongoUrl, {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
      });

      await this.client.connect();
      this.db = this.client.db('chainguard');

      // Test connection
      await this.db.command({ ping: 1 });

      // Create collections and indexes
      await this.createCollections();

      logger.info('MongoDB connected successfully');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async createCollections() {
    try {
      // Create collections if they don't exist
      const collections = ['users', 'subnets', 'transactions', 'threat_analyses', 'alerts', 'alert_logs'];

      for (const collectionName of collections) {
        const existingCollections = await this.db.listCollections({ name: collectionName }).toArray();
        if (existingCollections.length === 0) {
          await this.db.createCollection(collectionName);
          logger.info(`Created collection: ${collectionName}`);
        }
      }

      // Create indexes
      await this.createIndexes();

      // Create default admin user
      await this.createDefaultAdmin();

      logger.info('Database collections and indexes created/verified');
    } catch (error) {
      logger.error('Failed to create collections:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Users indexes
      await this.db.collection('users').createIndexes([
        { key: { username: 1 }, unique: true },
        { key: { email: 1 }, unique: true },
        { key: { role: 1 } }
      ]);

      // Subnets indexes
      await this.db.collection('subnets').createIndexes([
        { key: { chain_id: 1 }, unique: true },
        { key: { is_active: 1 } },
        { key: { monitoring_enabled: 1 } },
        { key: { created_by: 1 } }
      ]);

      // Transactions indexes
      await this.db.collection('transactions').createIndexes([
        { key: { tx_hash: 1 }, unique: true },
        { key: { subnet_id: 1 } },
        { key: { from_address: 1 } },
        { key: { to_address: 1 } },
        { key: { block_number: 1 } },
        { key: { status: 1 } },
        { key: { created_at: -1 } }
      ]);

      // Threat analyses indexes
      await this.db.collection('threat_analyses').createIndexes([
        { key: { tx_hash: 1 }, unique: true },
        { key: { subnet_id: 1 } },
        { key: { threat_level: 1 } },
        { key: { final_score: 1 } },
        { key: { created_at: -1 } }
      ]);

      // Alerts indexes
      await this.db.collection('alerts').createIndexes([
        { key: { alert_id: 1 }, unique: true },
        { key: { tx_hash: 1 } },
        { key: { subnet_id: 1 } },
        { key: { threat_level: 1 } },
        { key: { threat_score: 1 } },
        { key: { acknowledged: 1 } },
        { key: { false_positive: 1 } },
        { key: { created_at: -1 } }
      ]);

      // Alert logs indexes
      await this.db.collection('alert_logs').createIndexes([
        { key: { alert_id: 1 } },
        { key: { channel: 1 } },
        { key: { status: 1 } },
        { key: { sent_at: -1 } }
      ]);

      logger.info('Indexes created successfully');
    } catch (error) {
      logger.warn('Some indexes may already exist:', error.message);
    }
  }

  async createDefaultAdmin() {
    try {
      const adminExists = await this.db.collection('users').findOne({ username: 'admin' });

      if (!adminExists) {
        const passwordHash = await bcrypt.hash('admin123', 10);
        await this.db.collection('users').insertOne({
          username: 'admin',
          email: 'admin@chainguard.local',
          password_hash: passwordHash,
          role: 'admin',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        });
        logger.info('Default admin user created');
      }
    } catch (error) {
      logger.error('Failed to create default admin:', error);
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
        password_hash: passwordHash,
        role,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      const user = await this.db.collection('users').findOne({ _id: result.insertedId });
      return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at
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
        password_hash: user.password_hash,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
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
      return this.formatSubnet(subnet);
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

      return subnets.map(subnet => this.formatSubnet(subnet));
    } catch (error) {
      logger.error('Failed to get subnets:', error);
      throw error;
    }
  }

  async getSubnetById(id) {
    try {
      const subnet = await this.db.collection('subnets').findOne({ _id: new ObjectId(id) });
      return subnet ? this.formatSubnet(subnet) : null;
    } catch (error) {
      logger.error('Failed to get subnet:', error);
      throw error;
    }
  }

  async updateSubnet(id, updates) {
    try {
      const result = await this.db.collection('subnets').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      const updatedSubnet = result.value || result; // Handle different driver versions
      return updatedSubnet ? this.formatSubnet(updatedSubnet) : null;
    } catch (error) {
      logger.error('Failed to update subnet:', error);
      throw error;
    }
  }

  async deleteSubnet(id) {
    try {
      const subnet = await this.db.collection('subnets').findOne({ _id: new ObjectId(id) });
      if (!subnet) return null;

      await this.db.collection('subnets').deleteOne({ _id: new ObjectId(id) });
      return this.formatSubnet(subnet);
    } catch (error) {
      logger.error('Failed to delete subnet:', error);
      throw error;
    }
  }

  // Transaction management
  async getTransactions(subnetId, limit = 100, offset = 0, filters = {}) {
    try {
      const query = { 'subnet.subnetId': new ObjectId(subnetId) };

      if (filters.fromAddress) query.fromAddress = filters.fromAddress;
      if (filters.toAddress) query.toAddress = filters.toAddress;
      if (filters.status !== undefined) query.status = filters.status;

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      const transactions = await this.db.collection('transactions')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return transactions.map(tx => this.formatTransaction(tx));
    } catch (error) {
      logger.error('Failed to get transactions:', error);
      throw error;
    }
  }

  async getTransactionByHash(txHash) {
    try {
      const transaction = await this.db.collection('transactions').findOne({ txHash });
      return transaction ? this.formatTransaction(transaction) : null;
    } catch (error) {
      logger.error('Failed to get transaction:', error);
      throw error;
    }
  }

  // Alert management
  async getAlerts(subnetId, limit = 100, offset = 0, filters = {}) {
    try {
      const query = { 'subnet.subnetId': new ObjectId(subnetId) };

      if (filters.threatLevel) query.threatLevel = filters.threatLevel;
      if (filters.acknowledged !== undefined) query.acknowledged = filters.acknowledged;

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      const alerts = await this.db.collection('alerts')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return alerts.map(alert => this.formatAlert(alert));
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
              at: new Date()
            },
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );
      const updatedAlert = result.value || result;
      return updatedAlert ? this.formatAlert(updatedAlert) : null;
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
            markedBy: {
              userId: new ObjectId(userId),
              at: new Date()
            },
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );
      const updatedAlert = result.value || result;
      return updatedAlert ? this.formatAlert(updatedAlert) : null;
    } catch (error) {
      logger.error('Failed to mark false positive:', error);
      throw error;
    }
  }

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
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        this.db.collection('threat_analyses').countDocuments({
          'subnet.subnetId': subnetObjectId,
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        this.db.collection('alerts').countDocuments({
          'subnet.subnetId': subnetObjectId,
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        })
      ]);

      const threatLevels = {
        critical_threats: 0,
        high_threats: 0,
        medium_threats: 0,
        low_threats: 0
      };

      threatsByLevel.forEach(item => {
        if (item._id === 'CRITICAL') threatLevels.critical_threats = item.count;
        if (item._id === 'HIGH') threatLevels.high_threats = item.count;
        if (item._id === 'MEDIUM') threatLevels.medium_threats = item.count;
        if (item._id === 'LOW') threatLevels.low_threats = item.count;
      });

      return {
        total_transactions: totalTransactions,
        successful_transactions: successfulTransactions,
        failed_transactions: totalTransactions - successfulTransactions,
        total_threats: totalThreats,
        ...threatLevels,
        total_alerts: totalAlerts,
        acknowledged_alerts: acknowledgedAlerts,
        false_positive_alerts: falsePositives,
        avg_threat_score: avgThreatScore[0]?.avg || 0,
        today_transactions: todayTransactions,
        today_threats: todayThreats,
        today_alerts: todayAlerts
      };
    } catch (error) {
      logger.error('Failed to get subnet stats:', error);
      throw error;
    }
  }

  // Formatting helpers
  formatSubnet(subnet) {
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

  formatTransaction(tx) {
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

  formatAlert(alert) {
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
