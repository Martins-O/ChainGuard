const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { handleError } = require('../middleware/errorHandler');

// GET /subnets/:id/alerts - Get alerts for a subnet
router.get('/:id/alerts', 
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
      handleError(res, error, 'Get alerts');
    }
  }
);

// PATCH /alerts/:id/acknowledge - Acknowledge an alert
router.patch('/alerts/:id/acknowledge', 
  auth,
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { ObjectId } = require('mongodb');
      const alertId = req.params.id;

      if (!ObjectId.isValid(alertId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert ID format.'
        });
      }

      const alert = await db.getAlertById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found. It may have already been resolved.'
        });
      }

      const updatedAlert = await db.acknowledgeAlert(alertId, req.user.userId);

      res.json({
        success: true,
        data: updatedAlert
      });
    } catch (error) {
      handleError(res, error, 'Acknowledge alert');
    }
  }
);

// POST /alerts/:id/false-positive - Mark alert as false positive
router.post('/alerts/:id/false-positive', 
  auth,
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { ObjectId } = require('mongodb');
      const alertId = req.params.id;

      if (!ObjectId.isValid(alertId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert ID format.'
        });
      }

      const alert = await db.getAlertById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found. It may have already been resolved.'
        });
      }

      const updatedAlert = await db.markFalsePositive(alertId, req.user.userId);

      res.json({
        success: true,
        data: updatedAlert
      });
    } catch (error) {
      handleError(res, error, 'Mark false positive');
    }
  }
);

module.exports = router;
