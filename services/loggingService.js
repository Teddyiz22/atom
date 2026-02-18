const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const moment = require('moment');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: () => moment().format('YYYY-MM-DD HH:mm:ss')
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: () => moment().format('YYYY-MM-DD HH:mm:ss')
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
);

// Create Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: consoleFormat,
            level: 'debug'
        }),
        
        // Daily rotate file for all logs
        new DailyRotateFile({
            filename: path.join(logsDir, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info'
        }),
        
        // Daily rotate file for error logs only
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error'
        }),
        
        // Daily rotate file for user activity logs
        new DailyRotateFile({
            filename: path.join(logsDir, 'user-activity-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

class LoggingService {
    constructor() {
        this.logger = logger;
    }

    // General logging methods
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // User activity logging methods
    logUserActivity(activityType, userId, details = {}) {
        const logData = {
            activityType,
            userId,
            timestamp: moment().toISOString(),
            userAgent: details.userAgent || 'Unknown',
            ipAddress: details.ipAddress || 'Unknown',
            sessionId: details.sessionId || 'Unknown',
            details: details.additionalData || {}
        };

        this.logger.info(`USER_ACTIVITY: ${activityType}`, logData);
    }

    // Specific activity logging methods
    logLogin(userId, userEmail, ipAddress, userAgent, success = true) {
        this.logUserActivity('LOGIN', userId, {
            userEmail,
            ipAddress,
            userAgent,
            success,
            additionalData: {
                loginTime: moment().toISOString(),
                status: success ? 'SUCCESS' : 'FAILED'
            }
        });
    }

    logLogout(userId, userEmail, ipAddress, userAgent) {
        this.logUserActivity('LOGOUT', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                logoutTime: moment().toISOString()
            }
        });
    }

    logRegistration(userId, userEmail, ipAddress, userAgent) {
        this.logUserActivity('REGISTRATION', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                registrationTime: moment().toISOString()
            }
        });
    }

    logWalletTopup(userId, userEmail, amount, currency, paymentMethod, transactionId, ipAddress, userAgent) {
        this.logUserActivity('WALLET_TOPUP', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                amount,
                currency,
                paymentMethod,
                transactionId,
                topupTime: moment().toISOString()
            }
        });
    }

    logPurchase(userId, userEmail, productId, productName, amount, currency, ipAddress, userAgent) {
        this.logUserActivity('PURCHASE', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                productId,
                productName,
                amount,
                currency,
                purchaseTime: moment().toISOString()
            }
        });
    }

    logWalletTransaction(userId, userEmail, transactionType, amount, currency, balanceBefore, balanceAfter, ipAddress, userAgent) {
        this.logUserActivity('WALLET_TRANSACTION', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                transactionType, // 'DEBIT' or 'CREDIT'
                amount,
                currency,
                balanceBefore,
                balanceAfter,
                transactionTime: moment().toISOString()
            }
        });
    }

    logProfileUpdate(userId, userEmail, updatedFields, ipAddress, userAgent) {
        this.logUserActivity('PROFILE_UPDATE', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                updatedFields,
                updateTime: moment().toISOString()
            }
        });
    }

    logPasswordChange(userId, userEmail, ipAddress, userAgent, success = true) {
        this.logUserActivity('PASSWORD_CHANGE', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                success,
                changeTime: moment().toISOString()
            }
        });
    }

    logSuspiciousActivity(userId, userEmail, activityDescription, ipAddress, userAgent, riskLevel = 'MEDIUM') {
        this.logUserActivity('SUSPICIOUS_ACTIVITY', userId, {
            userEmail,
            ipAddress,
            userAgent,
            additionalData: {
                activityDescription,
                riskLevel, // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
                detectedTime: moment().toISOString()
            }
        });
    }

    // HTTP request logging
    logHttpRequest(req, res, responseTime) {
        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.get('User-Agent') || 'Unknown',
            ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
            userId: req.user ? req.user.id : 'Anonymous',
            timestamp: moment().toISOString()
        };

        if (res.statusCode >= 400) {
            this.error(`HTTP ${res.statusCode}: ${req.method} ${req.originalUrl}`, logData);
        } else {
            this.info(`HTTP ${res.statusCode}: ${req.method} ${req.originalUrl}`, logData);
        }
    }

    logError(...args) {
        let error;
        let context = {};
        let errorCode = null;
        let userId = null;

        if (args.length >= 4 && args[2] instanceof Error) {
            userId = args[0];
            errorCode = args[1];
            error = args[2];
            context = args[3] || {};
        } else if (args.length >= 3 && args[1] instanceof Error) {
            errorCode = args[0];
            error = args[1];
            context = args[2] || {};
        } else if (args[0] instanceof Error) {
            error = args[0];
            context = args[1] || {};
        } else {
            const message = args[0] || 'Unknown error';
            error = new Error(message);
            context = args[1] || {};
        }

        const errorData = {
            message: error.message,
            stack: error.stack,
            timestamp: moment().toISOString(),
            context,
            errorCode,
            userId
        };

        this.error('Application Error', errorData);
    }
}

const loggingService = new LoggingService();

const logUserActivity = async (userId, actionType, metadata = {}) => {
    try {
        const { UserActivityLog } = require('../models');
        
        await UserActivityLog.create({
            user_id: userId,
            action_type: actionType,
            metadata: metadata,
            ip_address: metadata.ipAddress || null,
            user_agent: metadata.userAgent || null,
            user_email: metadata.userEmail || null
        });
        
        // Also log to winston
        loggingService.info(`USER_ACTIVITY: ${actionType}`, {
            userId,
            actionType,
            metadata
        });
    } catch (error) {
        loggingService.error('Failed to log user activity', {
            userId,
            actionType,
            metadata,
            error: error.message
        });
    }
};

loggingService.logUserActivity = logUserActivity;

module.exports = loggingService;
