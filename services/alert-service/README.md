# ChainGuard Alert Service

## Overview
Alert management service that processes security threat alerts from the AI engine and routes them to appropriate notification channels.

## Features

### Alert Processing
- Real-time consumption from Redis queue
- Duplicate detection and deduplication
- Alert persistence in MongoDB
- Notification status tracking

### Notification Channels
- **CRITICAL** → Slack + Email + SMS
- **HIGH** → Slack + Email  
- **MEDIUM** → Slack
- **LOW** → Log only

### Integrations
- **Slack** - Webhook notifications with rich formatting
- **Discord** - Embedded notifications
- **Email** - HTML email alerts via SendGrid or SMTP
- **SMS** - Text messages via Twilio

### Management Features
- Alert acknowledgment
- False positive marking
- Alert history and filtering
- Statistics and metrics

## API Endpoints

### GET /health
Health check with service status.

### GET /alerts
Get alert history with pagination and filtering.

**Query Parameters:**
- `limit`: Number of alerts to return (default: 100)
- `offset`: Pagination offset (default: 0)
- `threatLevel`: Filter by threat level (CRITICAL, HIGH, MEDIUM, LOW)
- `startDate`: Filter by start date (ISO format)
- `endDate`: Filter by end date (ISO format)
- `acknowledged`: Filter by acknowledgment status (true/false)

### GET /alerts/:alertId
Get detailed information about a specific alert.

### PATCH /alerts/:alertId/acknowledge
Acknowledge an alert.

**Request Body:**
```json
{
  "userId": "optional_user_id"
}
```

### POST /alerts/:alertId/false-positive
Mark an alert as false positive.

**Request Body:**
```json
{
  "userId": "optional_user_id"
}
```

### GET /stats
Get alert statistics.

### POST /test-notification
Test notification channels.

**Request Body:**
```json
{
  "channel": "slack|discord|email|sms"
}
```

## Configuration

### Environment Variables

#### Database
- `DATABASE_URL`: MongoDB connection string

#### Redis
- `REDIS_URL`: Redis connection string

#### Email (SendGrid)
- `SENDGRID_API_KEY`: SendGrid API key
- `ALERT_EMAIL_RECIPIENTS`: Comma-separated list of recipient emails
- `EMAIL_FROM`: From email address

#### Email (SMTP)
- `SMTP_HOST`: SMTP server host
- `SMTP_PORT`: SMTP server port (default: 587)
- `SMTP_SECURE`: Use SSL/TLS (true/false)
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password

#### SMS (Twilio)
- `TWILIO_ACCOUNT_SID`: Twilio Account SID
- `TWILIO_AUTH_TOKEN`: Twilio Auth Token
- `TWILIO_PHONE_NUMBER`: Twilio phone number
- `SMS_RECIPIENTS`: Comma-separated list of recipient phone numbers

#### Slack
- `SLACK_WEBHOOK_URL`: Slack webhook URL

#### Discord
- `DISCORD_WEBHOOK_URL`: Discord webhook URL

#### Service
- `PORT`: Service port (default: 3001)
- `LOG_LEVEL`: Logging level (default: info)

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

## Database Schema

### Alerts Table
- `alert_id`: UUID for alert identification
- `tx_hash`: Related transaction hash
- `threat_score`: AI-calculated threat score (0-100)
- `threat_level`: Threat level (CRITICAL, HIGH, MEDIUM, LOW)
- `explanation`: Human-readable explanation
- `transaction_data`: Full transaction data (JSONB)
- `notification_channels`: Channels used for notification (JSONB)
- `notification_sent`: Whether notifications were sent successfully
- `acknowledged`: Whether alert has been acknowledged
- `false_positive`: Whether alert was marked as false positive
- `created_at`: Alert creation timestamp
- `updated_at`: Last update timestamp

### Alert Logs Table
- `alert_id`: Reference to alert
- `channel`: Notification channel used
- `status`: Notification status (sent/failed)
- `message`: Notification message
- `error`: Error message (if failed)
- `sent_at`: Timestamp of notification attempt

## Alert Processing Flow

1. **Consume**: Alert data from Redis `alerts` queue
2. **Deduplicate**: Check for recent duplicate alerts
3. **Persist**: Store alert in database
4. **Route**: Determine notification channels based on threat level
5. **Notify**: Send notifications via configured channels
6. **Log**: Record notification results
7. **Update**: Mark alert as processed

## Security Considerations

- All API endpoints are protected by authentication middleware
- Sensitive configuration data stored in environment variables
- Rate limiting implemented on public endpoints
- Input validation on all API requests
- Database connection pooling and query sanitization

## Monitoring

The service provides Prometheus-compatible metrics at `/metrics`:

- `chainguard_alerts_total`: Total number of alerts
- `chainguard_alerts_by_level`: Alerts by threat level
- `chainguard_alerts_acknowledged`: Number of acknowledged alerts
- `chainguard_alerts_false_positives`: Number of false positive alerts
- `chainguard_queue_length`: Current alert queue length

## Deployment

The service is containerized with Docker and can be deployed using the provided docker-compose configuration or as a standalone container.

### Docker Build
```bash
docker build -t chainguard-alert-service .
```

### Docker Run
```bash
docker run -p 3001:3001 --env-file .env chainguard-alert-service
```