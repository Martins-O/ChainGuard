const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { handleError } = require('../middleware/errorHandler');

// GET /subnets/:id/transactions - Get transactions for a subnet
router.get('/:id/transactions', 
  auth, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { ObjectId } = require('mongodb');
      const subnetId = req.params.id;

      if (!ObjectId.isValid(subnetId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subnet ID format. Please check the URL and try again.'
        });
      }

      // Check if subnet exists
      const subnet = await db.getSubnetById(subnetId);
      if (!subnet) {
        return res.status(404).json({
          success: false,
          error: 'Subnet not found. It may have been deleted or the ID is incorrect.'
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
      handleError(res, error, 'Get transactions');
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
          error: 'Invalid transaction hash format. Expected a 64-character hex string starting with 0x.'
        });
      }

      const transaction = await db.getTransactionByHash(txHash);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found. It may not exist in the database yet.'
        });
      }

      res.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      handleError(res, error, 'Get transaction');
    }
  }
);

module.exports = router;
