const nodemailer = require('nodemailer');
const axios = require('axios');
const twilio = require('twilio');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.twilioClient = null;
    this.initializeServices();
  }

  initializeServices() {
    // Initialize email service
    if (process.env.SENDGRID_API_KEY) {
      this.emailTransporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
      logger.info('Email service initialized with SendGrid');
    } else if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      logger.info('Email service initialized with SMTP');
    }

    // Initialize Twilio for SMS
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      logger.info('SMS service initialized with Twilio');
    }
  }

  async sendNotification(alertData, channels) {
    const results = [];

    for (const channel of channels) {
      try {
        const result = await this.sendToChannel(alertData, channel);
        results.push({ channel, success: true, result });
      } catch (error) {
        logger.error(`Failed to send ${channel} notification:`, error);
        results.push({ channel, success: false, error: error.message });
      }
    }

    return results;
  }

  async sendToChannel(alertData, channel) {
    switch (channel) {
      case 'slack':
        return await this.sendSlackNotification(alertData);
      case 'discord':
        return await this.sendDiscordNotification(alertData);
      case 'email':
        return await this.sendEmailNotification(alertData);
      case 'sms':
        return await this.sendSMSNotification(alertData);
      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }

  async sendSlackNotification(alertData) {
    if (!this.slackWebhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = this.getThreatColor(alertData.threatLevel);
    const emoji = this.getThreatEmoji(alertData.threatLevel);

    const payload = {
      text: `${emoji} ChainGuard Security Alert: ${alertData.threatLevel} Threat Detected`,
      attachments: [{
        color: color,
        fields: [
          {
            title: 'Transaction Hash',
            value: `\`${alertData.txHash}\``,
            short: true
          },
          {
            title: 'Threat Score',
            value: `${alertData.threatScore}/100`,
            short: true
          },
          {
            title: 'Threat Level',
            value: alertData.threatLevel,
            short: true
          },
          {
            title: 'Explanation',
            value: alertData.explanation,
            short: false
          }
        ],
        footer: 'ChainGuard AI',
        ts: Math.floor(new Date(alertData.createdAt).getTime() / 1000)
      }]
    };

    const response = await axios.post(this.slackWebhookUrl, payload);
    logger.info(`Slack notification sent for alert ${alertData.alertId}`);
    return response.data;
  }

  async sendDiscordNotification(alertData) {
    if (!this.discordWebhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }

    const color = this.getThreatColorHex(alertData.threatLevel);
    const emoji = this.getThreatEmoji(alertData.threatLevel);

    const payload = {
      content: `${emoji} ChainGuard Security Alert: ${alertData.threatLevel} Threat Detected`,
      embeds: [{
        title: 'Security Threat Detected',
        color: color,
        fields: [
          {
            name: 'Transaction Hash',
            value: `\`${alertData.txHash}\``,
            inline: true
          },
          {
            name: 'Threat Score',
            value: `${alertData.threatScore}/100`,
            inline: true
          },
          {
            name: 'Threat Level',
            value: alertData.threatLevel,
            inline: true
          },
          {
            name: 'Explanation',
            value: alertData.explanation,
            inline: false
          }
        ],
        footer: {
          text: 'ChainGuard AI'
        },
        timestamp: new Date(alertData.createdAt).toISOString()
      }]
    };

    const response = await axios.post(this.discordWebhookUrl, payload);
    logger.info(`Discord notification sent for alert ${alertData.alertId}`);
    return response.data;
  }

  async sendEmailNotification(alertData) {
    if (!this.emailTransporter) {
      throw new Error('Email service not configured');
    }

    const recipients = process.env.ALERT_EMAIL_RECIPIENTS 
      ? process.env.ALERT_EMAIL_RECIPIENTS.split(',').map(email => email.trim())
      : [];

    if (recipients.length === 0) {
      throw new Error('No email recipients configured');
    }

    const subject = `ChainGuard Alert: ${alertData.threatLevel} Threat Detected`;
    const html = this.generateEmailHTML(alertData);

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'chainguard@example.com',
      to: recipients.join(', '),
      subject,
      html
    };

    const result = await this.emailTransporter.sendMail(mailOptions);
    logger.info(`Email notification sent for alert ${alertData.alertId}`);
    return result;
  }

  async sendSMSNotification(alertData) {
    if (!this.twilioClient) {
      throw new Error('SMS service not configured');
    }

    const recipients = process.env.SMS_RECIPIENTS 
      ? process.env.SMS_RECIPIENTS.split(',').map(phone => phone.trim())
      : [];

    if (recipients.length === 0) {
      throw new Error('No SMS recipients configured');
    }

    const message = `ChainGuard Alert: ${alertData.threatLevel} threat detected. TX: ${alertData.txHash}. Score: ${alertData.threatScore}/100`;

    const results = [];
    for (const recipient of recipients) {
      try {
        const result = await this.twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: recipient
        });
        results.push(result);
        logger.info(`SMS sent to ${recipient} for alert ${alertData.alertId}`);
      } catch (error) {
        logger.error(`Failed to send SMS to ${recipient}:`, error);
        throw error;
      }
    }

    return results;
  }

  getThreatColor(threatLevel) {
    switch (threatLevel) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'good';
      case 'LOW': return '#36a64f';
      default: return 'gray';
    }
  }

  getThreatColorHex(threatLevel) {
    switch (threatLevel) {
      case 'CRITICAL': return 0xFF0000;
      case 'HIGH': return 0xFFA500;
      case 'MEDIUM': return 0xFFFF00;
      case 'LOW': return 0x00FF00;
      default: return 0x808080;
    }
  }

  getThreatEmoji(threatLevel) {
    switch (threatLevel) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '⚡';
      case 'LOW': return 'ℹ️';
      default: return '🔍';
    }
  }

  generateEmailHTML(alertData) {
    const threatColor = this.getThreatColorHex(alertData.threatLevel);
    const emoji = this.getThreatEmoji(alertData.threatLevel);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ChainGuard Security Alert</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #${threatColor.toString(16).padStart(6, '0')}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #333; }
          .value { color: #666; word-break: break-all; }
          .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
          .hash { font-family: monospace; background-color: #f1f1f1; padding: 2px 4px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${emoji} ChainGuard Security Alert</h1>
            <p>${alertData.threatLevel} Threat Detected</p>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">Transaction Hash:</div>
              <div class="value"><span class="hash">${alertData.txHash}</span></div>
            </div>
            <div class="field">
              <div class="label">Threat Score:</div>
              <div class="value">${alertData.threatScore}/100</div>
            </div>
            <div class="field">
              <div class="label">Threat Level:</div>
              <div class="value">${alertData.threatLevel}</div>
            </div>
            <div class="field">
              <div class="label">Explanation:</div>
              <div class="value">${alertData.explanation}</div>
            </div>
            <div class="field">
              <div class="label">Time Detected:</div>
              <div class="value">${new Date(alertData.createdAt).toLocaleString()}</div>
            </div>
          </div>
          <div class="footer">
            <p>This alert was generated by ChainGuard AI Security Monitoring System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async testNotification(channel) {
    const testAlert = {
      alertId: 'test-' + Date.now(),
      txHash: '0x1234567890abcdef1234567890abcdef12345678',
      threatScore: 85.0,
      threatLevel: 'HIGH',
      explanation: 'Test notification for ChainGuard system verification',
      createdAt: new Date().toISOString()
    };

    return await this.sendToChannel(testAlert, channel);
  }
}

module.exports = NotificationService;