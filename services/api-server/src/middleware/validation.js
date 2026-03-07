const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Validation schemas
const subnetValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('chainId')
    .trim()
    .matches(/^(0x)?[a-zA-Z0-9]+$/)
    .withMessage('Chain ID must contain only alphanumeric characters'),
  body('rpcUrl')
    .isURL()
    .withMessage('RPC URL must be a valid URL'),
  body('websocketUrl')
    .isURL()
    .withMessage('WebSocket URL must be a valid URL'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
];

const subnetUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('rpcUrl')
    .optional()
    .isURL()
    .withMessage('RPC URL must be a valid URL'),
  body('websocketUrl')
    .optional()
    .isURL()
    .withMessage('WebSocket URL must be a valid URL'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('monitoringEnabled')
    .optional()
    .isBoolean()
    .withMessage('monitoringEnabled must be a boolean')
];

const loginValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either user or admin')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

module.exports = {
  router,
  subnetValidation,
  subnetUpdateValidation,
  loginValidation,
  registerValidation,
  handleValidationErrors
};