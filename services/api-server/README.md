# ChainGuard API Server

## Overview
REST API server for the ChainGuard AI security monitoring platform, providing endpoints for managing subnets, transactions, alerts, and statistics.

## Features

### Authentication
- JWT-based authentication
- User registration and login
- Role-based access control (user/admin)
- Token verification

### Subnet Management
- Create, read, update, delete Avalanche subnets
- Configure RPC and WebSocket endpoints
- Enable/disable monitoring per subnet

### Transaction Data
- Retrieve transaction history for subnets
- Search transactions by hash, addresses, status
- Paginated results with filtering

### Alert Management
- View security alerts for subnets
- Acknowledge alerts
- Mark false positives
- Filter by threat level and status

### Statistics
- Comprehensive subnet statistics
- Transaction counts and threat analysis
- Alert metrics and trends

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/verify` - Token verification

### Subnets
- `POST /subnets` - Create new subnet (admin only)
- `GET /subnets` - List all subnets
- `GET /subnets/:id` - Get specific subnet
- `PATCH /subnets/:id` - Update subnet (admin only)
- `DELETE /subnets/:id` - Delete subnet (admin only)

### Transactions
- `GET /subnets/:id/transactions` - Get transactions for subnet
- `GET /transactions/:hash` - Get specific transaction by hash

### Alerts
- `GET /subnets/:id/alerts` - Get alerts for subnet
- `PATCH /alerts/:id/acknowledge` - Acknowledge alert
- `POST /alerts/:id/false-positive` - Mark as false positive

### Statistics
- `GET /subnets/:id/stats` - Get subnet statistics

### System
- `GET /health` - Health check
- `GET /` - API information

## Authentication

All endpoints except `/auth/*` and `/health` require authentication via JWT token.

**Authorization Header:**
```
Authorization: Bearer <jwt_token>
```

**Admin-only endpoints:**
- Create, update, delete subnets
- User registration (if restricted)

## Rate Limiting

Different rate limits apply to different endpoint types:

- **Auth endpoints**: 5 requests per 15 minutes
- **General API**: 1000 requests per 15 minutes  
- **Search endpoints**: 100 requests per 15 minutes
- **Create operations**: 50 requests per hour

## Request/Response Format

All responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": [ ... ] // For validation errors
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 250
  }
}
```

## Configuration

### Environment Variables

#### Database
- `DATABASE_URL`: PostgreSQL connection string

#### JWT
- `JWT_SECRET`: Secret key for JWT signing (default: provided)

#### Service
- `PORT`: API server port (default: 3000)
- `LOG_LEVEL`: Logging level (default: info)
- `NODE_ENV`: Environment (default: production)

## Database Schema

### Users Table
- `id`: Primary key
- `username`: Unique username
- `email`: Unique email address
- `password_hash`: Bcrypt hash of password
- `role`: User role (user/admin)
- `is_active`: Account status
- `created_at`: Account creation timestamp

### Subnets Table
- `id`: Primary key
- `name`: Subnet display name
- `chain_id`: Unique chain identifier
- `rpc_url`: RPC endpoint URL
- `websocket_url`: WebSocket endpoint URL
- `description`: Optional description
- `is_active`: Whether subnet is active
- `monitoring_enabled`: Whether monitoring is enabled
- `created_by`: User who created subnet
- `created_at`: Creation timestamp

### Transactions Table
- `id`: Primary key
- `tx_hash`: Transaction hash (unique)
- `subnet_id`: Reference to subnet
- `block_number`: Block number
- `transaction_index`: Transaction index in block
- `from_address`: Sender address
- `to_address`: Recipient address
- `value`: Transaction value
- `gas_used`: Gas used
- `gas_limit`: Gas limit
- `gas_price`: Gas price
- `transaction_data`: Full transaction data (JSONB)
- `decoded_call`: Decoded function call (JSONB)
- `logs`: Transaction logs (JSONB)
- `status`: Transaction success status
- `created_at`: Ingestion timestamp

### Threat Analyses Table
- `id`: Primary key
- `tx_hash`: Transaction hash (unique)
- `subnet_id`: Reference to subnet
- `signature_score`: Signature detection score
- `anomaly_score`: Anomaly detection score
- `behavioral_score`: Behavioral analysis score
- `final_score`: Combined threat score
- `threat_level`: Threat level classification
- `explanation`: Human-readable explanation
- `raw_transaction`: Raw transaction data (JSONB)
- `created_at`: Analysis timestamp

### Alerts Table
- `id`: Primary key
- `alert_id`: Unique alert identifier
- `tx_hash`: Related transaction hash
- `subnet_id`: Reference to subnet
- `threat_score`: AI-calculated threat score
- `threat_level`: Threat level
- `explanation`: Alert explanation
- `transaction_data`: Transaction data (JSONB)
- `notification_channels`: Channels used (JSONB)
- `notification_sent`: Whether notifications were sent
- `acknowledged`: Whether alert was acknowledged
- `false_positive`: Whether marked as false positive
- `acknowledged_by`: User who acknowledged
- `acknowledged_at`: Acknowledgment timestamp
- `created_at`: Alert creation timestamp

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt for secure password storage
- **Rate Limiting**: Prevent API abuse and DDoS attacks
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js for security headers
- **SQL Injection Prevention**: Parameterized queries

## Error Handling

The API provides detailed error responses:

- **400 Bad Request**: Validation errors, malformed requests
- **401 Unauthorized**: Authentication required, invalid token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Duplicate resource (e.g., existing username)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side errors

## Development

### Install Dependencies
```bash
npm install
```

### Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Run in Development
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Linting
```bash
npm run lint
npm run format
```

## API Examples

### Create Subnet
```bash
curl -X POST http://localhost:3000/subnets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Subnet",
    "chainId": "test-chain-123",
    "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
    "websocketUrl": "wss://api.avax-test.network/ext/bc/C/ws",
    "description": "Test subnet for development"
  }'
```

### Get Subnet Transactions
```bash
curl -X GET "http://localhost:3000/subnets/1/transactions?limit=50&status=true" \
  -H "Authorization: Bearer <token>"
```

### Acknowledge Alert
```bash
curl -X PATCH http://localhost:3000/alerts/123/acknowledge \
  -H "Authorization: Bearer <token>"
```

## Deployment

The service is containerized with Docker and can be deployed using the provided docker-compose configuration or as a standalone container.

### Docker Build
```bash
docker build -t chainguard-api-server .
```

### Docker Run
```bash
docker run -p 3000:3000 --env-file .env chainguard-api-server
```

## Monitoring

The API provides health check endpoints and structured logging for monitoring and observability.

### Health Check
```bash
curl http://localhost:3000/health
```

Returns service status and database connectivity information.