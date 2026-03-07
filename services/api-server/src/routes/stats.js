const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { handleError } = require('../middleware/errorHandler');

// GET /subnets/:id/stats - Get statistics for a subnet
router.get('/:id/stats', 
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

      const stats = await db.getSubnetStats(subnetId);

      res.json({
        success: true,
        data: {
          subnet: {
            id: subnet.id,
            name: subnet.name,
            chainId: subnet.chain_id
          },
          statistics: stats
        }
      });
    } catch (error) {
      handleError(res, error, 'Get stats');
    }
  }
);

module.exports = router;
