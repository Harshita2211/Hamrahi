/**
 * Security Utilities
 * Security headers and protection middleware
 */

/**
 * Setup security headers for the Express app
 */
const setupSecurityHeaders = (app) => {
  app.use((req, res, next) => {
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Clickjacking protection
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Security Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HSTS (HTTPS only)
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  });
};

/**
 * Validate and sanitize user input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  // Basic XSS prevention
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

/**
 * Rate limiting configuration
 */
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

export { setupSecurityHeaders, sanitizeInput, rateLimitConfig };
