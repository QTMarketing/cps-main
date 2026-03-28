#!/usr/bin/env node

/**
 * Custom Next.js Server with HTTPS Configuration
 * 
 * This server provides:
 * - HTTPS redirection for production
 * - Security headers via Helmet.js
 * - HSTS (HTTP Strict Transport Security)
 * - Compression for better performance
 * - Environment-based configuration
 * 
 * Usage:
 * - Development: npm run dev (uses Next.js dev server)
 * - Production: npm run start (uses this custom server)
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Configuration
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const httpsPort = parseInt(process.env.HTTPS_PORT || '3443', 10);
const forceHttps = process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production';

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Security configuration
const securityConfig = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // XSS Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
};

// HTTPS redirection middleware
function httpsRedirect(req, res, next) {
  // Skip HTTPS redirection in development
  if (!forceHttps) {
    return next();
  }
  
  // Check if request is already HTTPS
  if (req.headers['x-forwarded-proto'] === 'https' || req.secure) {
    return next();
  }
  
  // Redirect HTTP to HTTPS
  const httpsUrl = `https://${req.headers.host}${req.url}`;
  console.log(`Redirecting HTTP to HTTPS: ${req.url} → ${httpsUrl}`);
  
  return res.redirect(301, httpsUrl);
}

// Security headers middleware
function securityHeaders(req, res, next) {
  // Apply helmet security headers
  helmet(securityConfig)(req, res, next);
}

// Request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;
    
    if (res.statusCode >= 400) {
      console.error(`❌ ${logMessage}`);
    } else {
      console.log(`✅ ${logMessage}`);
    }
  });
  
  next();
}

// Error handling middleware
function errorHandler(err, req, res, next) {
  console.error('Server Error:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: dev ? err.message : 'Something went wrong',
  });
}

// Health check endpoint
function healthCheck(req, res, next) {
  if (req.url === '/health') {
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    });
  }
  
  next();
}

// Main server setup
async function startServer() {
  try {
    console.log('🚀 Starting QT Office Check Printing System Server...');
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Force HTTPS: ${forceHttps}`);
    console.log(`Port: ${port}`);
    console.log(`HTTPS Port: ${httpsPort}`);
    
    // Prepare Next.js app
    await app.prepare();
    
    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        // Parse URL
        const parsedUrl = parse(req.url, true);
        
        // Apply middleware in order
        requestLogger(req, res, () => {
          healthCheck(req, res, () => {
            httpsRedirect(req, res, () => {
              securityHeaders(req, res, () => {
                compression()(req, res, () => {
                  // Handle Next.js requests
                  handle(req, res, parsedUrl);
                });
              });
            });
          });
        });
      } catch (err) {
        console.error('Request handling error:', err);
        errorHandler(err, req, res);
      }
    });
    
    // Attach Socket.IO
    const io = new Server(server, {
      cors: { origin: '*'}
    });

    io.on('connection', (socket) => {
      // Join a session room
      socket.on('session:join', (sessionId) => {
        socket.join(sessionId);
        io.to(sessionId).emit('session:scanning');
      });

      // Receive uploaded image from mobile and forward to desktop
      socket.on('invoice:upload', async (payload) => {
        const { sessionId, imageData } = payload || {};
        if (!sessionId || !imageData) return;
        io.to(sessionId).emit('invoice:uploaded', { imageData });
      });

      socket.on('disconnect', () => {
        // no-op
      });
    });

    // Start server
    server.listen(port, (err) => {
      if (err) {
        throw err;
      }
      
      console.log(`✅ Server ready on http://${hostname}:${port}`);
      
      if (forceHttps) {
        console.log(`🔒 HTTPS redirection enabled`);
        console.log(`📋 Security headers configured`);
        console.log(`🛡️  HSTS enabled`);
      }
      
      console.log(`🏥 Health check available at http://${hostname}:${port}/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();


