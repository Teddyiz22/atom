const loggingService = require('../services/loggingService');
const { logUserActivity: logUserActivityDB } = require('../services/loggingService');

/**
 * Middleware to log HTTP requests and responses
 */
const requestLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    
    // Capture original end function
    const originalEnd = res.end;
    
    // Override res.end to capture response details
    res.end = function(chunk, encoding) {
        const responseTime = Date.now() - startTime;
        
        // Log the HTTP request
        loggingService.logHttpRequest({
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            userId: req.user ? req.user.id : null,
            userEmail: req.user ? req.user.email : null,
            sessionId: req.sessionID,
            referer: req.get('Referer'),
            contentLength: res.get('Content-Length')
        });
        
        // Call original end function
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

/**
 * Middleware to log user activities
 */
const activityLoggingMiddleware = (activityType, options = {}) => {
    return (req, res, next) => {
        // Store activity info in request for later use
        req.activityLog = {
            type: activityType,
            options: options,
            timestamp: new Date()
        };
        
        next();
    };
};

/**
 * Helper function to log user activity from request
 */
const logUserActivity = async (req, activityType, details = {}, success = true) => {
    const userId = req.user ? req.user.id : null;
    const metadata = {
        userEmail: req.user ? req.user.email : null,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID,
        ...details,
        url: req.originalUrl || req.url,
        method: req.method,
        success: success
    };
    
    // Use the standalone function that saves to database
    await logUserActivityDB(userId, activityType, metadata);
};

/**
 * Middleware to log errors
 */
const errorLoggingMiddleware = (err, req, res, next) => {
    const errorData = {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl || req.url,
        method: req.method,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.id : null,
        userEmail: req.user ? req.user.email : null,
        sessionId: req.sessionID,
        statusCode: err.statusCode || 500
    };
    
    loggingService.logError('HTTP_ERROR', err, errorData);
    
    next(err);
};

/**
 * Security logging middleware for suspicious activities
 */
const securityLoggingMiddleware = (req, res, next) => {
    const suspiciousPatterns = [
        /\.\.\//,  // Directory traversal
        /<script/i,  // XSS attempts
        /union.*select/i,  // SQL injection
        /javascript:/i,  // JavaScript injection
        /eval\(/i,  // Code injection
        /base64_decode/i  // Encoded payloads
    ];
    
    const checkSuspicious = (value) => {
        if (typeof value === 'string') {
            return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        return false;
    };
    
    // Check URL, query parameters, and body for suspicious content
    const url = req.originalUrl || req.url;
    const queryString = JSON.stringify(req.query);
    const bodyString = JSON.stringify(req.body);
    
    if (checkSuspicious(url) || checkSuspicious(queryString) || checkSuspicious(bodyString)) {
        loggingService.logUserActivity('SECURITY_ALERT', {
            userId: req.user ? req.user.id : null,
            userEmail: req.user ? req.user.email : null,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            sessionId: req.sessionID,
            details: {
                suspiciousUrl: url,
                query: req.query,
                body: req.body,
                alertType: 'SUSPICIOUS_REQUEST_PATTERN'
            },
            success: false
        });
    }
    
    next();
};

module.exports = {
    requestLoggingMiddleware,
    activityLoggingMiddleware,
    logUserActivity,
    errorLoggingMiddleware,
    securityLoggingMiddleware
};