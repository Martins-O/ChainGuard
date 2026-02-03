const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// GET /subnets/:id/transactions - Get transactions for a subnet
router.get('/:id/transactions', 
  auth, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const subnetId = parseInt(req.params.id);

      if (isNaN(subnetId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subnet ID'
        });
      }

      // Check if subnet exists
      const subnet = await db.getSubnetById(subnetId);
      if (!subnet) {
        return res.status(404).json({
          success: false,
          error: 'Subnet not found'
        });
      }

      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const filters = {
        fromAddress: req.query.fromAddress,
        toAddress: req.query.toAddress,
        status: req.query.status === 'true' ? true : (req.query.status === 'false' ? false : undefined),
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const transactions = await db.getTransactions(subnetId, limit, offset, filters);

      res.json({
        success: true,
        data: transactions,
        pagination: {
          limit,
          offset,
          total: transactions.length
        }
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transactions'
      });
    }
  }
);

// GET /transactions/:hash - Get specific transaction by hash
router.get('/:hash', 
  auth, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const txHash = req.params.hash;

      // Validate transaction hash format
      if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction hash format'
        });
      }

      const transaction = await db.getTransactionByHash(txHash);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      res.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transaction'
      });
    }
  }
);

module.exports = router;