/**
 * Carpool Connect - Main Server Application
 * 
 * This is the main entry point for the Carpool Connect application.
 * It sets up the Express.js server, configures middleware, and defines routes.
 * 
 * Key Features:
 * - Express.js server setup with comprehensive middleware
 * - Session management and authentication
 * - Route handling for web pages and API endpoints
 * - Error handling and logging
 * - Template rendering with EJS
 * 
 * Author: Carpool Connect Team
 * Version: 1.0.0
 */

// ============================================================================
// IMPORTS AND CONFIGURATION
// ============================================================================

// Load environment variables from .env file
// This must be done before any other imports that depend on environment variables
import dotenv from 'dotenv';
dotenv.config();

// Import core Node.js and Express.js modules
import express from 'express';                    // Web framework
import path from 'path';                        // File path utilities
import { fileURLToPath } from 'url';            // ES Module URL utilities
import cookieParser from 'cookie-parser';        // Cookie parsing middleware
import expressLayouts from 'express-ejs-layouts'; // EJS layout support
import session from 'express-session';            // Session management
import flash from 'connect-flash';                // Flash messages for notifications

// Get __dirname equivalent for ES Modules
// In CommonJS, __dirname is available globally, but in ES Modules we need to calculate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import custom utilities and middleware
import { validateConfig, isDevelopment } from './utils/config.js';           // Configuration validation
import { requestLogger, errorHandler, notFoundHandler } from './utils/middleware.js'; // Custom middleware
import { formatDate, formatCurrency, timeAgo } from './utils/helpers.js';           // Helper functions

// Import route handlers
// Each route file handles a specific section of the application
import indexRoutes from './routes/index.js';    // Main routes (home, trips, etc.)
import authRoutes from './routes/auth.js';      // Authentication routes (login, register)
import profileRoutes from './routes/profile.js'; // User profile routes
import apiRoutes from './routes/api.js';        // API endpoints

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

// Debug logging to check if required environment variables are loaded
// This helps with troubleshooting configuration issues
console.log('🔍 DEBUG: Checking environment variables before validation...');
console.log('🔍 SUPABASE_URL:', process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING');
console.log('🔍 SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING');

// Validate that all required environment variables are present
// This will throw an error if critical configuration is missing
validateConfig();

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3000; // Use environment port or default to 3000

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Body parsing middleware - Parse incoming request bodies
// These middleware parse JSON and URL-encoded data from requests
app.use(express.json({ limit: '10mb' }));                    // Parse JSON payloads (up to 10MB)
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded payloads
app.use(cookieParser());                                      // Parse cookies for authentication

// Session middleware - Manage user sessions
// This creates and maintains user sessions for authentication and state management
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Secret key for session encryption
    resave: false,                                           // Don't save session if unmodified
    saveUninitialized: false,                                // Don't save uninitialized sessions
    cookie: { 
      secure: false,                                         // Allow cookies over HTTP (set to true in production with HTTPS)
      maxAge: 60000                                         // Session expires after 1 minute (60000ms)
    },
  })
);

// Flash message middleware - Store temporary messages between requests
// Used for displaying notifications (success, error, info) to users
app.use(flash());

// Static file serving - Serve static assets (CSS, JS, images)
// Serves files from the 'public' directory at the root URL
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware (development only)
// Logs detailed information about incoming requests for debugging
if (isDevelopment()) {
  app.use(requestLogger);
}

// View helpers middleware - Make helper functions available in EJS templates
// These functions can be used directly in EJS templates for formatting data
app.use((req, res, next) => {
  res.locals.formatDate = formatDate;      // Format dates in human-readable format
  res.locals.formatCurrency = formatCurrency; // Format currency with proper symbols
  res.locals.timeAgo = timeAgo;            // Format timestamps as "time ago"
  next();
});

// ============================================================================
// VIEW ENGINE SETUP
// ============================================================================

// Configure EJS as the template engine
// EJS allows us to generate HTML with plain JavaScript
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set views directory

// Use express-ejs-layouts for consistent page layouts
// This automatically wraps all views in the main layout template
app.use(expressLayouts);
app.set('layout', 'layout'); // Use 'layout.ejs' as the default layout

// ============================================================================
// ROUTES
// ============================================================================

// API routes - Handle API endpoints for frontend and external integrations
// These routes return JSON data and are used by the frontend JavaScript
app.use('/api', apiRoutes);

// Web routes - Handle page rendering and user-facing routes
// Each route file handles a specific section of the application
app.use('/', indexRoutes);      // Main routes: home, trips, trip details
app.use('/auth', authRoutes);    // Authentication: login, register, logout
app.use('/profile', profileRoutes); // User profile: view, edit, settings

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 Not Found handler - Must be registered before other error handlers
// This handles requests to routes that don't exist
app.use(notFoundHandler);

// Global error handler - Must be the last middleware in the stack
// This catches all errors that occur in the application and formats them properly
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Start the Express server and begin listening for incoming requests
const server = app.listen(PORT, () => {
  console.log('\n🚀 Carpool Connect Server Started Successfully');
  console.log(`📍 Server: http://localhost:${PORT}`);           // Display server URL
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`); // Show environment
  console.log(`📊 Time: ${new Date().toISOString()}`);           // Show startup time
  console.log('\n✅ Ready to accept connections\n');             // Indicate server is ready
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

// Handle graceful server shutdown when receiving termination signals
// This ensures proper cleanup and prevents data corruption
const gracefulShutdown = (signal) => {
  console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);

  // Close the HTTP server and stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exitCode = 0; // Exit successfully
    // Allow process to exit naturally
  });

  // Force close after 10 seconds if graceful shutdown takes too long
  const forceClose = setTimeout(() => {
    console.log('⚠️ Forcing server shutdown after timeout');
    process.exitCode = 1; // Exit with error code
    process.exit();
  }, 10000);

  // Clear timeout if server closes successfully
  server.on('close', () => {
    clearTimeout(forceClose);
  });
};

// Register graceful shutdown handlers for common termination signals
// These signals are sent by the operating system when the process should terminate
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Termination signal
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Interrupt signal (Ctrl+C)

// Handle uncaught exceptions and rejections to prevent crashes
// These handlers log the error and exit gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Export the app for testing purposes
export default app;
