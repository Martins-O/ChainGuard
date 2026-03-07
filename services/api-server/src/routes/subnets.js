const express = require('express');
const router = express.Router();
const { subnetValidation, subnetUpdateValidation, handleValidationErrors } = require('../middleware/validation');
const { auth, adminOnly } = require('../middleware/auth');

// POST /subnets - Create new subnet
router.post('/', 
  auth, 
  adminOnly, 
  subnetValidation, 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { name, chainId, rpcUrl, websocketUrl, description } = req.body;

      // Check if subnet with same chain_id already exists
      const existingSubnets = await db.getSubnets(1000, 0);
      const duplicate = existingSubnets.find(s => s.chain_id === chainId);
      
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'Subnet with this chain ID already exists'
        });
      }

      const subnet = await db.createSubnet({
        name,
        chainId,
        rpcUrl,
        websocketUrl,
        description,
        createdBy: req.user.userId
      });

      res.status(201).json({
        success: true,
        data: subnet
      });
    } catch (error) {
      console.error('Create subnet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create subnet'
      });
    }
  }
);

// GET /subnets - List all subnets
router.get('/', 
  auth, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const filters = {
        isActive: req.query.isActive === 'true' ? true : (req.query.isActive === 'false' ? false : undefined),
        monitoringEnabled: req.query.monitoringEnabled === 'true' ? true : (req.query.monitoringEnabled === 'false' ? false : undefined)
      };

      const subnets = await db.getSubnets(limit, offset, filters);

      res.json({
        success: true,
        data: subnets,
        pagination: {
          limit,
          offset,
          total: subnets.length
        }
      });
    } catch (error) {
      console.error('Get subnets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve subnets'
      });
    }
  }
);

// GET /subnets/:id - Get specific subnet
router.get('/:id', 
  auth, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { ObjectId } = require('mongodb');
      const subnetId = req.params.id;

      if (!ObjectId.isValid(subnetId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subnet ID format'
        });
      }

      const subnet = await db.getSubnetById(subnetId);

      if (!subnet) {
        return res.status(404).json({
          success: false,
          error: 'Subnet not found'
        });
      }

      res.json({
        success: true,
        data: subnet
      });
    } catch (error) {
      console.error('Get subnet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve subnet'
      });
    }
  }
);

// PATCH /subnets/:id - Update subnet
router.patch('/:id', 
  auth, 
  adminOnly, 
  subnetUpdateValidation, 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { ObjectId } = require('mongodb');
      const subnetId = req.params.id;

      if (!ObjectId.isValid(subnetId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subnet ID format'
        });
      }

      // Check if subnet exists
      const existingSubnet = await db.getSubnetById(subnetId);
      if (!existingSubnet) {
        return res.status(404).json({
          success: false,
          error: 'Subnet not found'
        });
      }

      // Prepare update data
      const updates = {};
      const allowedFields = ['name', 'rpcUrl', 'websocketUrl', 'description', 'isActive', 'monitoringEnabled'];
      
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const updatedSubnet = await db.updateSubnet(subnetId, updates);

      res.json({
        success: true,
        data: updatedSubnet
      });
    } catch (error) {
      console.error('Update subnet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update subnet'
      });
    }
  }
);

// DELETE /subnets/:id - Delete subnet
router.delete('/:id', 
  auth, 
  adminOnly, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { ObjectId } = require('mongodb');
      const subnetId = req.params.id;

      // Validate ObjectId format
      if (!ObjectId.isValid(subnetId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subnet ID format'
        });
      }

      // Check if subnet exists
      const existingSubnet = await db.getSubnetById(subnetId);
      if (!existingSubnet) {
        return res.status(404).json({
          success: false,
          error: 'Subnet not found'
        });
      }

      const deletedSubnet = await db.deleteSubnet(subnetId);

      res.json({
        success: true,
        data: deletedSubnet
      });
    } catch (error) {
      console.error('Delete subnet error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete subnet'
      });
    }
  }
);

module.exports = router;