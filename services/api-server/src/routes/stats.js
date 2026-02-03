const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// GET /subnets/:id/stats - Get statistics for a subnet
router.get('/:id/stats', 
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
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  }
);

module.exports = router;