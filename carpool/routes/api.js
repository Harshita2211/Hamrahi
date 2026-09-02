import { Router } from 'express';
import { geocodeAddress, getRoute, validateApiKey, checkApiHealth } from '../utils/api.js';

const router = Router();

/**
 * API Routes for external services
 * These routes handle geocoding and routing requests with proper error handling
 */

/**
 * POST /api/geocode
 * Geocode an address to coordinates
 * Body: { address: string, limit: number }
 */
router.post('/geocode', async (req, res) => {
  try {
    const { address, limit = 1 } = req.body;

    console.log(`🌐 API: Geocode request for "${address}" with limit ${limit}`);

    if (!address || typeof address !== 'string') {
      console.log('❌ API: Invalid address provided');
      return res.status(400).json({
        error: 'Address is required and must be a string',
      });
    }

    // Nominatim OSM doesn't require API key
    const result = await geocodeAddress(address, null, limit);

    if (result.suggestions) {
      console.log(`✅ API: Returning ${result.suggestions.length} suggestions`);
      // Return suggestions for autocomplete
      return res.json({
        suggestions: result.suggestions,
        query: address,
      });
    } else {
      console.log('✅ API: Returning single geocoded result');
      // Return single result for geocoding
      return res.json(result);
    }
  } catch (error) {
    console.error('❌ API: Geocoding error:', error);
    return res.status(500).json({
      error: 'Geocoding service temporarily unavailable. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/route
 * Calculate route between two points
 * Body: { origin: {lat, lng}, destination: {lat, lng} }
 */
router.post('/route', async (req, res) => {
  try {
    const { origin, destination } = req.body;

    console.log(
      `🌐 API: Route request from ${origin?.lat},${origin?.lng} to ${destination?.lat},${destination?.lng}`
    );

    if (
      !origin ||
      !destination ||
      !origin.lat ||
      !origin.lng ||
      !destination.lat ||
      !destination.lng
    ) {
      console.log('❌ API: Invalid coordinates provided');
      return res.status(400).json({
        error: 'Valid origin and destination coordinates are required',
      });
    }

    // Simple route calculation doesn't require API key
    const result = await getRoute(origin, destination, null);

    console.log('✅ API: Route calculated successfully');
    return res.json(result);
  } catch (error) {
    console.error('❌ API: Routing error:', error);
    return res.status(500).json({
      error: 'Routing service temporarily unavailable. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/health
 * Check the health of external services
 */
router.get('/health', async (req, res) => {
  try {
    const health = await checkApiHealth();

    const allHealthy = Object.values(health).every(
      (service) => service.status === 'healthy' || service.status === 'not_configured'
    );

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      services: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/status
 * Get API configuration status
 */
router.get('/status', (req, res) => {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;

  res.json({
    openrouteservice: {
      configured: validateApiKey(apiKey, 'openrouteservice'),
      key_length: apiKey ? apiKey.length : 0,
    },
    supabase: {
      configured: !!(supabaseUrl && supabaseUrl.includes('supabase.co')),
      url: supabaseUrl ? supabaseUrl.replace(/\/\/.*@/, '//***@') : null,
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Error handling middleware for API routes
 */
router.use((error, req, res, next) => {
  console.error('API route error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  // Don't expose internal errors in production
  const message =
    process.env.NODE_ENV === 'production' ? 'An internal error occurred' : error.message;

  res.status(500).json({
    error: message,
    success: false,
    timestamp: new Date().toISOString(),
  });
});

export default router;
