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
      // Create collections if they don't exist
      const collections = ['users', 'subnets', 'transactions', 'threat_analyses', 'alerts', 'alert_logs'];
      
      for (const collectionName of collections) {
        const collections = await this.db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
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
      logger.error('Failed to create indexes:', error);
      throw error;
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
        chain_id: chainId,
        rpc_url: rpcUrl,
        websocket_url: websocketUrl,
        description: description || null,
        is_active: true,
        monitoring_enabled: true,
        created_by: createdBy ? new ObjectId(createdBy) : null,
        created_at: new Date(),
        updated_at: new Date()
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
        query.is_active = filters.isActive;
      }
      if (filters.monitoringEnabled !== undefined) {
        query.monitoring_enabled = filters.monitoringEnabled;
      }

      const subnets = await this.db.collection('subnets')
        .find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(offset)
        .toArray();

      return subnets.map(s => this.formatSubnet(s));
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
      return null;
    }
  }

  async updateSubnet(id, updates) {
    try {
      const updateDoc = { ...updates, updated_at: new Date() };
      
      // Convert field names from camelCase to snake_case if needed
      const formattedUpdates = {};
      Object.keys(updateDoc).forEach(key => {
        const mongoKey = key === 'isActive' ? 'is_active' : 
                        key === 'monitoringEnabled' ? 'monitoring_enabled' : key;
        formattedUpdates[mongoKey] = updateDoc[key];
      });

      await this.db.collection('subnets').updateOne(
        { _id: new ObjectId(id) },
        { $set: formattedUpdates }
      );

      const subnet = await this.db.collection('subnets').findOne({ _id: new ObjectId(id) });
      return subnet ? this.formatSubnet(subnet) : null;
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

  formatSubnet(subnet) {
    return {
      id: subnet._id.toString(),
      name: subnet.name,
      chain_id: subnet.chain_id,
      rpc_url: subnet.rpc_url,
      websocket_url: subnet.websocket_url,
      description: subnet.description,
      is_active: subnet.is_active,
      monitoring_enabled: subnet.monitoring_enabled,
      created_by: subnet.created_by?.toString(),
      created_at: subnet.created_at,
      updated_at: subnet.updated_at
    };
  }

  // Transaction management
  async getTransactions(subnetId, limit = 100, offset = 0, filters = {}) {
    try {
      const query = { subnet_id: new ObjectId(subnetId) };

      if (filters.fromAddress) {
        query.from_address = filters.fromAddress;
      }
      if (filters.toAddress) {
        query.to_address = filters.toAddress;
      }
      if (filters.status !== undefined) {
        query.status = filters.status;
      }
      if (filters.startDate) {
        query.created_at = { ...query.created_at, $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query.created_at = { ...query.created_at, $lte: new Date(filters.endDate) };
      }

      const transactions = await this.db.collection('transactions')
        .find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(offset)
        .toArray();

      return transactions.map(t => this.formatTransaction(t));
    } catch (error) {
      logger.error('Failed to get transactions:', error);
      throw error;
    }
  }

  async getTransactionByHash(txHash) {
    try {
      const transaction = await this.db.collection('transactions').findOne({ tx_hash: txHash });
      return transaction ? this.formatTransaction(transaction) : null;
    } catch (error) {
      logger.error('Failed to get transaction:', error);
      throw error;
    }
  }

  formatTransaction(tx) {
    return {
      id: tx._id.toString(),
      tx_hash: tx.tx_hash,
      subnet_id: tx.subnet_id?.toString(),
      block_number: tx.block_number,
      transaction_index: tx.transaction_index,
      from_address: tx.from_address,
      to_address: tx.to_address,
      value: tx.value,
      gas_used: tx.gas_used,
      gas_limit: tx.gas_limit,
      gas_price: tx.gas_price,
      transaction_data: tx.transaction_data,
      decoded_call: tx.decoded_call,
      logs: tx.logs,
      status: tx.status,
      created_at: tx.created_at
    };
  }

  // Alert management
  async getAlerts(subnetId, limit = 100, offset = 0, filters = {}) {
    try {
      const query = { subnet_id: new ObjectId(subnetId) };

      if (filters.threatLevel) {
        query.threat_level = filters.threatLevel;
      }
      if (filters.acknowledged !== undefined) {
        query.acknowledged = filters.acknowledged;
      }
      if (filters.startDate) {
        query.created_at = { ...query.created_at, $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query.created_at = { ...query.created_at, $lte: new Date(filters.endDate) };
      }

      const alerts = await this.db.collection('alerts')
        .find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(offset)
        .toArray();

      return alerts.map(a => this.formatAlert(a));
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId, userId) {
    try {
      await this.db.collection('alerts').updateOne(
        { _id: new ObjectId(alertId) },
        {
          $set: {
            acknowledged: true,
            acknowledged_by: new ObjectId(userId),
            acknowledged_at: new Date(),
            updated_at: new Date()
          }
        }
      );

      const alert = await this.db.collection('alerts').findOne({ _id: new ObjectId(alertId) });
      return alert ? this.formatAlert(alert) : null;
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  async markFalsePositive(alertId, userId) {
    try {
      await this.db.collection('alerts').updateOne(
        { _id: new ObjectId(alertId) },
        {
          $set: {
            false_positive: true,
            acknowledged: true,
            acknowledged_by: new ObjectId(userId),
            acknowledged_at: new Date(),
            updated_at: new Date()
          }
        }
      );

      const alert = await this.db.collection('alerts').findOne({ _id: new ObjectId(alertId) });
      return alert ? this.formatAlert(alert) : null;
    } catch (error) {
      logger.error('Failed to mark alert as false positive:', error);
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

  // Statistics
  async getSubnetStats(subnetId) {
    try {
      const subnetObjectId = new ObjectId(subnetId);

      const [
        totalTransactions,
        successfulTransactions,
        totalThreats,
        criticalThreats,
        highThreats,
        mediumThreats,
        lowThreats,
        totalAlerts,
        acknowledgedAlerts,
        falsePositives,
        avgThreatScore,
        todayTransactions,
        todayThreats,
        todayAlerts
      ] = await Promise.all([
        this.db.collection('transactions').countDocuments({ subnet_id: subnetObjectId }),
        this.db.collection('transactions').countDocuments({ subnet_id: subnetObjectId, status: true }),
        this.db.collection('threat_analyses').countDocuments({ subnet_id: subnetObjectId }),
        this.db.collection('threat_analyses').countDocuments({ subnet_id: subnetObjectId, threat_level: 'CRITICAL' }),
        this.db.collection('threat_analyses').countDocuments({ subnet_id: subnetObjectId, threat_level: 'HIGH' }),
        this.db.collection('threat_analyses').countDocuments({ subnet_id: subnetObjectId, threat_level: 'MEDIUM' }),
        this.db.collection('threat_analyses').countDocuments({ subnet_id: subnetObjectId, threat_level: 'LOW' }),
        this.db.collection('alerts').countDocuments({ subnet_id: subnetObjectId }),
        this.db.collection('alerts').countDocuments({ subnet_id: subnetObjectId, acknowledged: true }),
        this.db.collection('alerts').countDocuments({ subnet_id: subnetObjectId, false_positive: true }),
        this.db.collection('threat_analyses').aggregate([
          { $match: { subnet_id: subnetObjectId } },
          { $group: { _id: null, avg: { $avg: '$final_score' } } }
        ]).toArray(),
        this.db.collection('transactions').countDocuments({
          subnet_id: subnetObjectId,
          created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        this.db.collection('threat_analyses').countDocuments({
          subnet_id: subnetObjectId,
          created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }),
        this.db.collection('alerts').countDocuments({
          subnet_id: subnetObjectId,
          created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        })
      ]);

      return {
        total_transactions: totalTransactions,
        successful_transactions: successfulTransactions,
        failed_transactions: totalTransactions - successfulTransactions,
        total_threats: totalThreats,
        critical_threats: criticalThreats,
        critical_alerts: criticalThreats,
        high_threats: highThreats,
        high_alerts: highThreats,
        medium_threats: mediumThreats,
        medium_alerts: mediumThreats,
        low_threats: lowThreats,
        low_alerts: lowThreats,
        total_alerts: totalAlerts,
        acknowledged_alerts: acknowledgedAlerts,
        false_positive_alerts: falsePositives,
        avg_threat_score: avgThreatScore.length > 0 ? avgThreatScore[0].avg || 0 : 0,
        today_transactions: todayTransactions,
        today_threats: todayThreats,
        today_alerts: todayAlerts
      };
    } catch (error) {
      logger.error('Failed to get subnet stats:', error);
      throw error;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      logger.info('Database connection closed');
    }
  }
}

module.exports = Database;
