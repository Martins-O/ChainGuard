const express = require('express');
const router = express.Router();
const { loginValidation, registerValidation, handleValidationErrors } = require('../middleware/validation');
const limits = require('../middleware/rateLimiting');

// POST /auth/login - User login
router.post('/login', 
  limits.auth,
  loginValidation, 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { username, password } = req.body;

      // Get user from database
      const user = await db.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await db.verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'Account is deactivated'
        });
      }

      // Generate JWT token
      const token = db.generateToken(user);

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }
);

// POST /auth/register - User registration (admin only)
router.post('/register', 
  limits.auth,
  registerValidation, 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const db = req.app.locals.database;
      const { username, email, password, role = 'user' } = req.body;

      // For now, we'll allow registration without auth
      // In production, you might want to require an existing admin user
      // or implement invitation system

      // Check if username already exists
      const existingUser = await db.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }

      // Create new user
      const newUser = await db.createUser({
        username,
        email,
        password,
        role
      });

      // Generate JWT token
      const token = db.generateToken(newUser);

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role
          }
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  }
);

// POST /auth/verify - Verify JWT token
router.post('/verify', 
  async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token is required'
        });
      }

      const db = req.app.locals.database;
      const jwt = require('jsonwebtoken');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
      
      // Get user info to ensure they're still active
      const user = await db.getUserByUsername(decoded.username);
      
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          },
          token
        }
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  }
);

module.exports = router;