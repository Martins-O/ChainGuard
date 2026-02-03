# 🔗 ChainGuard AI - Frontend API Integration Guide

This guide provides a comprehensive overview of all available ChainGuard AI APIs for seamless frontend integration.

## 📋 Table of Contents

- [Base Configuration](#-base-configuration)
- [Authentication](#-authentication)
- [Subnet Management](#-subnet-management)
- [Transaction Monitoring](#-transaction-monitoring)
- [Alert Management](#-alert-management)
- [Statistics & Analytics](#-statistics--analytics)
- [System Health](#-system-health)
- [Error Handling](#-error-handling)
- [Rate Limiting](#-rate-limiting)

---

## ⚙️ Base Configuration

**Base URL**: `http://localhost:3000`
**Content-Type**: `application/json`
**Authentication**: Bearer Token (JWT)

### API Base Path Structure
```
http://localhost:3000/
├── /auth          # Authentication endpoints
├── /subnets       # Subnet management
├── /transactions  # Transaction queries
├── /alerts        # Alert management
├── /stats         # Statistics and analytics
└── /health        # System health check
```

---

## 🔐 Authentication

All API endpoints (except login/register) require JWT authentication.

### Login
**Endpoint**: `POST /auth/login`
**Purpose**: Authenticate user and receive JWT token
**Used For**: Gaining access to protected endpoints

```javascript
const login = async (username, password) => {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (data.success) {
    // Store token for subsequent requests
    localStorage.setItem('token', data.data.token);
    return data.data.user;
  }
  throw new Error(data.error);
};

// Usage
const user = await login('admin', 'admin123');
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

### Register
**Endpoint**: `POST /auth/register`
**Purpose**: Create new user account
**Used For**: User registration (admin only in production)

```javascript
const register = async (username, email, password, role = 'user') => {
  const response = await fetch('http://localhost:3000/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, email, password, role })
  });
  
  return response.json();
};
```

### Verify Token
**Endpoint**: `POST /auth/verify`
**Purpose**: Validate JWT token and get user info
**Used For**: Checking token validity on app load

```javascript
const verifyToken = async (token) => {
  const response = await fetch('http://localhost:3000/auth/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  });
  
  return response.json();
};
```

---

## 🌐 Subnet Management

Manage Avalanche subnet configurations and monitoring settings.

### List All Subnets
**Endpoint**: `GET /subnets`
**Purpose**: Get all configured subnets
**Used For**: Displaying available networks in dropdown/dashboard

```javascript
const getSubnets = async (filters = {}) => {
  const params = new URLSearchParams({
    limit: filters.limit || 100,
    offset: filters.offset || 0,
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.monitoringEnabled !== undefined && { monitoringEnabled: filters.monitoringEnabled })
  });

  const response = await fetch(`http://localhost:3000/subnets?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};

// Usage
const subnets = await getSubnets({ isActive: true });
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Avalanche C-Chain",
      "chain_id": "43114",
      "rpc_url": "https://api.avax.network/ext/bc/C/rpc",
      "websocket_url": "wss://api.avax.network/ext/bc/C/ws",
      "description": "Avalanche Mainnet C-Chain",
      "is_active": true,
      "monitoring_enabled": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1
  }
}
```

### Get Specific Subnet
**Endpoint**: `GET /subnets/:id`
**Purpose**: Get detailed information about a specific subnet
**Used For**: Subnet detail pages, configuration views

```javascript
const getSubnet = async (subnetId) => {
  const response = await fetch(`http://localhost:3000/subnets/${subnetId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};
```

### Create Subnet (Admin Only)
**Endpoint**: `POST /subnets`
**Purpose**: Add new subnet for monitoring
**Used For**: Admin subnet configuration panel

```javascript
const createSubnet = async (subnetData) => {
  const response = await fetch('http://localhost:3000/subnets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(subnetData)
  });

  return response.json();
};

// Usage
const newSubnet = await createSubnet({
  name: "Testnet",
  chainId: "43113",
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  websocketUrl: "wss://api.avax-test.network/ext/bc/C/ws",
  description: "Avalanche Testnet C-Chain"
});
```

### Update Subnet (Admin Only)
**Endpoint**: `PATCH /subnets/:id`
**Purpose**: Update subnet configuration
**Used For**: Admin subnet management

```javascript
const updateSubnet = async (subnetId, updates) => {
  const response = await fetch(`http://localhost:3000/subnets/${subnetId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(updates)
  });

  return response.json();
};
```

### Delete Subnet (Admin Only)
**Endpoint**: `DELETE /subnets/:id`
**Purpose**: Remove subnet from monitoring
**Used For**: Admin subnet management

```javascript
const deleteSubnet = async (subnetId) => {
  const response = await fetch(`http://localhost:3000/subnets/${subnetId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};
```

---

## 📊 Transaction Monitoring

Query and analyze blockchain transactions monitored by ChainGuard.

### Get Subnet Transactions
**Endpoint**: `GET /subnets/:id/transactions`
**Purpose**: Get transactions for a specific subnet
**Used For**: Transaction list views, filtering and search

```javascript
const getTransactions = async (subnetId, filters = {}) => {
  const params = new URLSearchParams({
    limit: filters.limit || 100,
    offset: filters.offset || 0,
    ...(filters.fromAddress && { fromAddress: filters.fromAddress }),
    ...(filters.toAddress && { toAddress: filters.toAddress }),
    ...(filters.status !== undefined && { status: filters.status }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  const response = await fetch(`http://localhost:3000/subnets/${subnetId}/transactions?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};

// Usage
const transactions = await getTransactions(1, {
  fromAddress: "0x742d35Cc6474e40A2c5a7D8B6c8A8d9A1c2D3e4F",
  limit: 50
});
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 12345,
      "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "from_address": "0x742d35Cc6474e40A2c5a7D8B6c8A8d9A1c2D3e4F",
      "to_address": "0x1234567890123456789012345678901234567890",
      "value": "1000000000000000000",
      "gas_used": "21000",
      "gas_limit": "21000",
      "block_number": 12345678,
      "status": true,
      "threat_score": 15,
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1
  }
}
```

### Get Transaction by Hash
**Endpoint**: `GET /transactions/:hash`
**Purpose**: Get specific transaction details
**Used For**: Transaction detail pages, hash search

```javascript
const getTransactionByHash = async (txHash) => {
  const response = await fetch(`http://localhost:3000/transactions/${txHash}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};

// Usage
const transaction = await getTransactionByHash("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
```

---

## 🚨 Alert Management

Monitor and manage security alerts generated by ChainGuard AI.

### Get Subnet Alerts
**Endpoint**: `GET /subnets/:id/alerts`
**Purpose**: Get security alerts for a subnet
**Used For**: Alert dashboard, notification center

```javascript
const getAlerts = async (subnetId, filters = {}) => {
  const params = new URLSearchParams({
    limit: filters.limit || 100,
    offset: filters.offset || 0,
    ...(filters.threatLevel && { threatLevel: filters.threatLevel }),
    ...(filters.acknowledged !== undefined && { acknowledged: filters.acknowledged }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  const response = await fetch(`http://localhost:3000/subnets/${subnetId}/alerts?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};

// Usage
const criticalAlerts = await getAlerts(1, {
  threatLevel: "CRITICAL",
  acknowledged: false
});
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1001,
      "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "threat_level": "HIGH",
      "threat_score": 85,
      "alert_type": "anomaly_detection",
      "description": "Unusual transaction pattern detected",
      "acknowledged": false,
      "false_positive": false,
      "created_at": "2024-01-01T12:00:00Z",
      "acknowledged_at": null,
      "acknowledged_by": null
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1
  }
}
```

### Acknowledge Alert
**Endpoint**: `PATCH /alerts/:id/acknowledge`
**Purpose**: Mark alert as acknowledged
**Used For**: Alert management workflow

```javascript
const acknowledgeAlert = async (alertId) => {
  const response = await fetch(`http://localhost:3000/alerts/${alertId}/acknowledge`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};
```

### Mark False Positive
**Endpoint**: `POST /alerts/:id/false-positive`
**Purpose**: Mark alert as false positive
**Used For**: Improving AI model accuracy

```javascript
const markFalsePositive = async (alertId) => {
  const response = await fetch(`http://localhost:3000/alerts/${alertId}/false-positive`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};
```

---

## 📈 Statistics & Analytics

Get comprehensive statistics and analytics for monitored subnets.

### Get Subnet Statistics
**Endpoint**: `GET /subnets/:id/stats`
**Purpose**: Get comprehensive subnet statistics
**Used For**: Dashboard widgets, analytics panels

```javascript
const getSubnetStats = async (subnetId) => {
  const response = await fetch(`http://localhost:3000/subnets/${subnetId}/stats`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  return response.json();
};

// Usage
const stats = await getSubnetStats(1);
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subnet": {
      "id": 1,
      "name": "Avalanche C-Chain",
      "chainId": "43114"
    },
    "statistics": {
      "totalTransactions": 1234567,
      "totalAlerts": 1234,
      "criticalAlerts": 12,
      "highAlerts": 45,
      "mediumAlerts": 234,
      "lowAlerts": 943,
      "acknowledgedAlerts": 1100,
      "falsePositives": 50,
      "avgThreatScore": 35.5,
      "transactionsToday": 12345,
      "alertsToday": 23,
      "uptime": "99.9%",
      "lastAnalysis": "2024-01-01T12:00:00Z"
    }
  }
}
```

---

## 💊 System Health

Monitor the health and status of ChainGuard services.

### Health Check
**Endpoint**: `GET /health`
**Purpose**: Check system health status
**Used For**: Status indicators, monitoring dashboards
**Authentication**: None required

```javascript
const getHealthStatus = async () => {
  const response = await fetch('http://localhost:3000/health');
  return response.json();
};

// Usage
const health = await getHealthStatus();
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": {
    "database": "connected",
    "api": "running"
  }
}
```

---

## ⚠️ Error Handling

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... } // For list endpoints
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Frontend Error Handling Example
```javascript
const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        ...options.headers
      },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Usage with error handling
try {
  const subnets = await apiCall('http://localhost:3000/subnets');
  console.log('Subnets:', subnets.data);
} catch (error) {
  // Show error message to user
  showNotification(error.message, 'error');
}
```

---

## 🚦 Rate Limiting

The API implements rate limiting to prevent abuse:

- **General API**: 100 requests per minute
- **Authentication**: 10 requests per minute
- **Search/Filter**: 50 requests per minute

### Rate Limit Response
```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": 60
}
```

### Implementing Retry Logic
```javascript
const apiCallWithRetry = async (url, options = {}, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      return response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

---

## 🛠️ Frontend Implementation Examples

### React.js Hook Example
```javascript
import { useState, useEffect } from 'react';

export const useChainGuardAPI = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiCall = async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers
        },
        ...options
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { apiCall, loading, error };
};

// Usage in component
const Dashboard = () => {
  const token = localStorage.getItem('token');
  const { apiCall, loading, error } = useChainGuardAPI(token);
  const [subnets, setSubnets] = useState([]);

  useEffect(() => {
    const loadSubnets = async () => {
      try {
        const data = await apiCall('http://localhost:3000/subnets');
        setSubnets(data.data);
      } catch (err) {
        console.error('Failed to load subnets:', err);
      }
    };

    if (token) {
      loadSubnets();
    }
  }, [token, apiCall]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {subnets.map(subnet => (
        <div key={subnet.id}>{subnet.name}</div>
      ))}
    </div>
  );
};
```

### Vue.js Composable Example
```javascript
// composables/useChainGuard.js
import { ref } from 'vue';

export const useChainGuard = () => {
  const loading = ref(false);
  const error = ref(null);

  const apiCall = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers
        },
        ...options
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return { apiCall, loading, error };
};
```

---

## 📝 Quick Start Checklist

For frontend developers integrating ChainGuard AI:

1. **Authentication Setup**
   - [ ] Implement login functionality
   - [ ] Store JWT token securely
   - [ ] Add token to all API requests
   - [ ] Handle token expiration

2. **Core Components**
   - [ ] Subnet list and management
   - [ ] Transaction monitoring dashboard
   - [ ] Alert management interface
   - [ ] Statistics and analytics

3. **Error Handling**
   - [ ] Network error handling
   - [ ] Rate limiting implementation
   - [ ] User-friendly error messages

4. **Real-time Updates**
   - [ ] WebSocket connection for live alerts
   - [ ] Auto-refresh for critical data
   - [ ] Notification system

5. **Performance**
   - [ ] Pagination for large datasets
   - [ ] Caching strategies
   - [ ] Lazy loading for components

---

## 🆘 Support

For additional integration support:

- **API Documentation**: Built-in OpenAPI docs at `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`
- **Error Logs**: Check browser console for detailed error information
- **Rate Limiting**: Monitor `X-RateLimit-*` headers

---

*This guide covers all essential endpoints for frontend integration. For advanced usage and real-time features, refer to the WebSocket integration documentation.*