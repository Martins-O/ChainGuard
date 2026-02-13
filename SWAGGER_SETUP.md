# Swagger API Documentation Setup

This guide explains how to set up and use Swagger UI for testing the ChainGuard AI API.

## Overview

Swagger UI provides an interactive API documentation interface where you can:
- Browse all available endpoints
- View request/response schemas
- Test API endpoints directly from the browser
- Authenticate and make authenticated requests

## Prerequisites

1. API server dependencies installed:
   ```bash
   cd services/api-server
   npm install
   ```

2. API server running on `http://localhost:3000`

## Accessing Swagger UI

Once the API server is running, access Swagger UI at:

**URL**: `http://localhost:3000/api-docs`

## Using Swagger UI

### 1. Authentication

Before testing protected endpoints, you need to authenticate:

1. **Login to get JWT token:**
   - Navigate to the `/auth/login` endpoint in Swagger UI
   - Click "Try it out"
   - Enter credentials:
     ```json
     {
       "username": "admin",
       "password": "admin123"
     }
   - Click "Execute"
   - Copy the `token` from the response

2. **Authorize in Swagger UI:**
   - Click the green "Authorize" button at the top right
   - In the "Value" field, enter: `Bearer <your_token>`
     - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Click "Authorize"
   - Click "Close"

Now all protected endpoints will automatically include the JWT token in requests.

### 2. Testing Endpoints

1. **Find the endpoint** you want to test in the Swagger UI
2. **Click "Try it out"** button
3. **Fill in parameters:**
   - Path parameters (e.g., subnet ID)
   - Query parameters (e.g., limit, offset, filters)
   - Request body (for POST/PATCH requests)
4. **Click "Execute"**
5. **View the response:**
   - Response code (200, 404, etc.)
   - Response body (JSON)
   - Response headers

### 3. Example: Testing Subnet Endpoints

#### Get All Subnets
1. Expand `/subnets` → `GET /subnets`
2. Click "Try it out"
3. Optionally set query parameters:
   - `limit`: 10
   - `offset`: 0
   - `isActive`: true
4. Click "Execute"
5. View the list of subnets

#### Create a Subnet (Admin Only)
1. Expand `/subnets` → `POST /subnets`
2. Click "Try it out"
3. Fill in request body:
   ```json
   {
     "name": "Test Subnet",
     "chainId": "43113",
     "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
     "websocketUrl": "wss://api.avax-test.network/ext/bc/C/ws",
     "description": "Avalanche Testnet C-Chain"
   }
   ```
4. Click "Execute"
5. View the created subnet

#### Get Subnet by ID
1. Expand `/subnets/{id}` → `GET /subnets/{id}`
2. Click "Try it out"
3. Enter subnet ID in the `id` parameter field
4. Click "Execute"
5. View subnet details

### 4. Example: Testing Transaction Endpoints

#### Get Subnet Transactions
1. Expand `/subnets/{id}/transactions` → `GET /subnets/{id}/transactions`
2. Click "Try it out"
3. Enter subnet ID
4. Set query parameters:
   - `limit`: 50
   - `status`: true (for successful transactions only)
5. Click "Execute"
6. View transaction list

#### Get Transaction by Hash
1. Expand `/transactions/{hash}` → `GET /transactions/{hash}`
2. Click "Try it out"
3. Enter transaction hash (must be 0x-prefixed, 64 hex characters)
4. Click "Execute"
5. View transaction details

### 5. Example: Testing Alert Endpoints

#### Get Subnet Alerts
1. Expand `/subnets/{id}/alerts` → `GET /subnets/{id}/alerts`
2. Click "Try it out"
3. Enter subnet ID
4. Set filters:
   - `threatLevel`: HIGH
   - `acknowledged`: false
5. Click "Execute"
6. View filtered alerts

#### Acknowledge an Alert
1. Expand `/alerts/{id}/acknowledge` → `PATCH /alerts/{id}/acknowledge`
2. Click "Try it out"
3. Enter alert ID
4. Click "Execute"
5. View updated alert

### 6. Example: Testing Statistics

#### Get Subnet Statistics
1. Expand `/subnets/{id}/stats` → `GET /subnets/{id}/stats`
2. Click "Try it out"
3. Enter subnet ID
4. Click "Execute"
5. View comprehensive statistics

## Swagger Features

### Filter Endpoints
- Use the search box at the top to filter endpoints by name
- Useful when you have many endpoints

### Request/Response Schemas
- Click on any schema to expand and see all fields
- Understand required vs optional fields
- See example values

### Model Definitions
- Scroll to the bottom to see all data models
- Understand the structure of request/response objects

### Try It Out
- All endpoints support "Try it out" functionality
- Test endpoints without writing code
- See actual API responses

## Troubleshooting

### "401 Unauthorized" Errors
- Make sure you've authorized with a valid JWT token
- Token may have expired (tokens expire after 24 hours)
- Re-login and update the authorization token

### "404 Not Found" Errors
- Check that the resource ID exists
- Verify the endpoint path is correct
- Check that the API server is running

### "400 Bad Request" Errors
- Check request body format (must be valid JSON)
- Verify required fields are provided
- Check field types match the schema

### Swagger UI Not Loading
- Verify `swagger-ui-express` and `yamljs` are installed:
  ```bash
  cd services/api-server
  npm install swagger-ui-express yamljs
  ```
- Check that `swagger.yaml` exists in the project root
- Check server logs for errors

### CORS Errors
- If testing from a different origin, ensure CORS is configured
- The API server should have CORS enabled by default

## Updating Swagger Documentation

The Swagger documentation is defined in `/swagger.yaml` at the project root.

To update:
1. Edit `swagger.yaml`
2. Restart the API server
3. Refresh Swagger UI in the browser

## Alternative: Using Swagger Editor

You can also use Swagger Editor to view/edit the documentation:

1. **Online**: https://editor.swagger.io/
2. **Local**: 
   ```bash
   docker run -p 8080:8080 -e SWAGGER_FILE=/swagger.yaml -v $(pwd)/swagger.yaml:/swagger.yaml swaggerapi/swagger-editor
   ```
   Then access at `http://localhost:8080`

## API Testing Workflow

Recommended workflow for testing:

1. **Start API server**: `cd services/api-server && npm run dev`
2. **Open Swagger UI**: `http://localhost:3000/api-docs`
3. **Authenticate**: Login and authorize with JWT token
4. **Test endpoints**: Start with `/health`, then `/subnets`, etc.
5. **Verify responses**: Check response codes and data

## Next Steps

- Explore all endpoints in Swagger UI
- Test different query parameters and filters
- Try creating, updating, and deleting resources
- Test error scenarios (invalid IDs, missing fields, etc.)

For more information, see the main README.md file.
