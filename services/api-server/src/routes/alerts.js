const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// GET /subnets/:id/alerts - Get alerts for a subnet
router.get('/:id/alerts', 
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
        threatLevel: req.query.threatLevel,
        acknowledged: req.query.acknowledged === 'true' ? true : (req.query.acknowledged === 'false' ? false : undefined),
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const alerts = await db.getAlerts(subnetId, limit, offset, filters);

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
      console.error('Get alerts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts'
      });
    }
  }
);

// PATCH /alerts/:id/acknowledge - Acknowledge an alert
router.patch('/alerts/:id/acknowledge', 
  auth, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const alertId = parseInt(req.params.id);

      if (isNaN(alertId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert ID'
        });
      }

      const acknowledgedAlert = await db.acknowledgeAlert(alertId, req.user.userId);

      if (!acknowledgedAlert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      res.json({
        success: true,
        data: acknowledgedAlert
      });
    } catch (error) {
      console.error('Acknowledge alert error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge alert'
      });
    }
  }
);

// POST /alerts/:id/false-positive - Mark alert as false positive
router.post('/alerts/:id/false-positive', 
  auth, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const alertId = parseInt(req.params.id);

      if (isNaN(alertId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert ID'
        });
      }

      const updatedAlert = await db.markFalsePositive(alertId, req.user.userId);

      if (!updatedAlert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      res.json({
        success: true,
        data: updatedAlert
      });
    } catch (error) {
      console.error('Mark false positive error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark alert as false positive'
      });
    }
  }
);

module.exports = router;