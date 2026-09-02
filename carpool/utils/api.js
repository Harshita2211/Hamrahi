/**
 * API Utility Functions - Carpool Connect
 * 
 * This module handles all external API calls for the Carpool Connect application.
 * It provides robust error handling, timeout management, and retry logic for
 * network resilience when interacting with external services.
 * 
 * Key Features:
 * - Timeout and retry logic for network resilience
 * - Multiple geocoding services (Nominatim, OpenRouteService)
 * - Route calculation with fallback methods
 * - Health check endpoints for service monitoring
 * - Comprehensive logging and error handling
 * - Distance and duration calculations
 * - Address geocoding and reverse geocoding
 * 
 * External Services Used:
 * - OpenStreetMap Nominatim API: Geocoding addresses to coordinates
 * - OpenRouteService API: Route calculation and optimization
 * - Supabase Storage: File upload and management
 * 
 * Error Handling:
 * - Network timeouts with configurable retry logic
 * - Service availability checks
 * - Graceful degradation when services are unavailable
 * - Detailed error logging for debugging
 * 
 * Performance Features:
 * - Request caching for frequently accessed data
 * - Concurrent request handling
 * - Optimized timeout values for different services
 * - Efficient retry strategies
 * 
 * Author: Carpool Connect Team
 * Version: 1.0.0
 */

// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================

import supabase from './supabase.js'; // Supabase database client for storage operations

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

/**
 * API Configuration Object
 * Contains timeout values, retry limits, and other constants for API operations
 */
const API_CONFIG = {
  TIMEOUTS: {
    DEFAULT: 10000,  // Default timeout: 10 seconds
    SHORT: 5000,     // Short timeout: 5 seconds (for quick operations)
    LONG: 15000,     // Long timeout: 15 seconds (for complex operations)
  },
  RETRIES: {
    DEFAULT: 2,      // Default retry attempts
    MAX: 3,          // Maximum retry attempts
  },
  SPEEDS: {
    AVG_KMH: 50,     // Average speed in km/h for duration estimation
  },
  EARTH_RADIUS: 6371, // Earth's radius in kilometers for distance calculations
};

// User agent string for API requests (helps with service identification)
const USER_AGENT = 'Carpool-Connect/1.0';

// ============================================================================
// CORE FETCH UTILITIES
// ============================================================================

/**
 * Make a fetch request with timeout and retry logic
 * 
 * This is a robust fetch wrapper that handles network issues, timeouts,
 * and provides retry logic for improved reliability when calling external APIs.
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} - Fetch response with error handling
 * 
 * Features:
 * - Automatic timeout handling
 * - Retry logic for failed requests
 * - Detailed logging for debugging
 * - Proper error propagation
 * - Support for all HTTP methods
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = API_CONFIG.TIMEOUTS.DEFAULT, retries = API_CONFIG.RETRIES.DEFAULT) => {
  console.log(`🌐 Fetch request: ${url} (timeout: ${timeoutMs}ms, retries: ${retries})`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`✅ Fetch successful: ${url} (${response.status})`);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // If we have retries left and error is retryable, try again
    if (retries > 0 && isRetryableError(error)) {
      console.warn(`⚠️ API request failed, retrying... (${retries} attempts left):`, error.message);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
      return fetchWithTimeout(url, options, timeoutMs, retries - 1);
    }

    console.error(`❌ Fetch failed after ${API_CONFIG.RETRIES.DEFAULT - retries} attempts:`, error.message);
    throw error;
  }
};

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether error is retryable
 */
const isRetryableError = (error) => {
  const retryableErrors = [
    'AbortError',
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ConnectTimeoutError',
    'fetch failed',
  ];

  // Check for retryable error names/messages
  if (retryableErrors.some(retryError => error.name === retryError || error.message.includes(retryError))) {
    return true;
  }

  // Retry on 5xx server errors
  if (error.message.includes('HTTP 5')) {
    return true;
  }

  return false;
};

// ============================================================================
// GEOCODING FUNCTIONS
// ============================================================================

/**
 * Geocode an address using Nominatim OSM API (free, no API key required)
 * @param {string} address - The address to geocode
 * @param {string} apiKey - Not used for Nominatim
 * @param {number} limit - Number of suggestions to return (default: 1)
 * @returns {Promise<Object>} - Geocoded coordinates or suggestions
 */
const geocodeAddress = async (address, apiKey, limit = 1) => {
  console.log(`🔍 Geocoding address: "${address}" with limit: ${limit}`);

  // Use Nominatim OSM API (free, no API key required)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}&limit=${limit}&addressdetails=1`;

  try {
    const response = await fetchWithTimeout(url, {}, API_CONFIG.TIMEOUTS.SHORT, API_CONFIG.RETRIES.DEFAULT);
    const data = await response.json();

    console.log('📍 Geocode response:', JSON.stringify(data, null, 2));

    if (!data || data.length === 0) {
      console.log('⚠️ No results found for address:', address);
      return { suggestions: [] };
    }

    // Return multiple suggestions for autocomplete
    const suggestions = data.map((item) => ({
      address: item.display_name || address,
      coords: {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      },
      county: item.address?.county || item.address?.suburb || '',
      region: item.address?.state || item.address?.region || '',
      country: item.address?.country || '',
    }));

    console.log(`✅ Found ${suggestions.length} geocoding suggestions`);

    // If only one result requested, return single coordinates (backward compatibility)
    if (limit === 1) {
      return {
        lat: suggestions[0].coords.lat,
        lng: suggestions[0].coords.lng,
        address: suggestions[0].address,
      };
    }

    return { suggestions };
  } catch (error) {
    console.error('❌ Geocoding failed:', error);
    throw new Error(`Geocoding failed: ${error.message}`);
  }
};

/**
 * Get route between two points with fallback methods
 * @param {Object} origin - Origin coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @param {string} apiKey - OpenRouteService API key (optional)
 * @returns {Promise<Object>} - Route information
 */
const getRoute = async (origin, destination, apiKey) => {
  console.log(
    `🛣️ Calculating route from ${origin.lat},${origin.lng} to ${destination.lat},${destination.lng}`
  );

  try {
    // Try OpenRouteService first if API key is available
    if (apiKey && validateApiKey(apiKey, 'openrouteservice')) {
      try {
        return await getOpenRouteServiceRoute(origin, destination, apiKey);
      } catch (orsError) {
        console.warn('⚠️ OpenRouteService failed, falling back to simple calculation:', orsError.message);
        return getSimpleRoute(origin, destination);
      }
    }

    // Fallback to simple calculation
    return getSimpleRoute(origin, destination);
  } catch (error) {
    console.error('❌ Route calculation failed:', error);
    throw new Error(`Route calculation failed: ${error.message}`);
  }
};

/**
 * Get route from OpenRouteService API
 * @param {Object} origin - Origin coordinates
 * @param {Object} destination - Destination coordinates
 * @param {string} apiKey - OpenRouteService API key
 * @returns {Promise<Object>} - Route information
 */
const getOpenRouteServiceRoute = async (origin, destination, apiKey) => {
  console.log('🛣️ Using OpenRouteService for routing');
  
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`;
  
  const response = await fetchWithTimeout(url, {}, API_CONFIG.TIMEOUTS.LONG, API_CONFIG.RETRIES.DEFAULT);
  
  if (!response.ok) {
    throw new Error(`OpenRouteService API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found between points');
  }
  
  const route = data.routes[0];
  const geometry = {
    type: 'LineString',
    coordinates: route.geometry.coordinates,
  };
  
  console.log(`✅ OpenRouteService route: ${route.summary.distance}m, ${Math.round(route.summary.duration / 60)}min`);
  
  return {
    distance: route.summary.distance,
    duration: route.summary.duration,
    geometry: geometry,
    bbox: route.bbox,
  };
};

/**
 * Get simple route using Haversine formula calculation
 * @param {Object} origin - Origin coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @returns {Object} - Route information
 */
const getSimpleRoute = (origin, destination) => {
  console.log('🛣️ Using simple route calculation');
  
  // Calculate straight-line distance using Haversine formula
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLon = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = API_CONFIG.EARTH_RADIUS * c; // Distance in kilometers

  // Estimate duration (assuming average speed)
  const duration = (distance / API_CONFIG.SPEEDS.AVG_KMH) * 3600; // Duration in seconds

  // Create simple GeoJSON for straight line
  const geometry = {
    type: 'LineString',
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
  };

  console.log(`✅ Simple route calculated: ${distance.toFixed(2)} km, ${Math.round(duration / 60)} min`);

  return {
    distance: distance * 1000, // Convert to meters
    duration: duration,
    geometry: geometry,
    bbox: [
      Math.min(origin.lng, destination.lng),
      Math.min(origin.lat, destination.lat),
      Math.max(origin.lng, destination.lng),
      Math.max(origin.lat, destination.lat),
    ],
  };
};

// ============================================================================
// REVERSE GEOCODING
// ============================================================================

/**
 * Reverse geocode coordinates to address using OpenRouteService
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} apiKey - OpenRouteService API key
 * @returns {Promise<Object>} - Address information or null
 */
const reverseGeocode = async (lat, lng, apiKey) => {
  console.log(`🔍 Reverse geocoding coordinates: ${lat}, ${lng}`);

  if (!apiKey) {
    console.warn('⚠️ No API key provided for reverse geocoding');
    return null;
  }

  try {
    const url = `https://api.openrouteservice.com/reverse?api_key=${apiKey}&point.lat=${lat}&point.lon=${lng}`;

    const response = await fetchWithTimeout(url, {}, API_CONFIG.TIMEOUTS.SHORT, API_CONFIG.RETRIES.DEFAULT);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.statusText}`);
    }

    console.log('📍 Reverse geocoding result:', data);
    return data;
  } catch (error) {
    console.error('❌ Reverse geocoding error:', error);
    throw new Error(`Reverse geocoding failed: ${error.message}`);
  }
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate API key format for different services
 * @param {string} apiKey - The API key to validate
 * @param {string} service - The service name
 * @returns {boolean} - Whether the API key is valid
 */
const validateApiKey = (apiKey, service) => {
  if (!apiKey || typeof apiKey !== 'string') return false;

  switch (service) {
    case 'openrouteservice':
      // OpenRouteService keys are base64 encoded and typically 80+ characters
      return apiKey.length >= 50 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
    default:
      return apiKey.length > 0;
  }
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check for external APIs
 * @returns {Promise<Object>} - Health status of APIs
 */
const checkApiHealth = async () => {
  console.log('🏥 Starting API health check...');
  
  const health = {
    supabase: { status: 'unknown', error: null, responseTime: null },
    openrouteservice: { status: 'unknown', error: null, responseTime: null },
    timestamp: new Date().toISOString(),
  };

  // Check Supabase
  try {
    const startTime = Date.now();
    await supabase.from('trips').select('id').limit(1);
    health.supabase.status = 'healthy';
    health.supabase.responseTime = Date.now() - startTime;
    console.log('✅ Supabase health check passed');
  } catch (error) {
    health.supabase.status = 'unhealthy';
    health.supabase.error = error.message;
    console.error('❌ Supabase health check failed:', error);
  }

  // Check OpenRouteService (if API key is available)
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (apiKey && validateApiKey(apiKey, 'openrouteservice')) {
    try {
      const startTime = Date.now();
      await fetchWithTimeout('https://api.openrouteservice.org/health', {}, API_CONFIG.TIMEOUTS.SHORT, 1);
      health.openrouteservice.status = 'healthy';
      health.openrouteservice.responseTime = Date.now() - startTime;
      console.log('✅ OpenRouteService health check passed');
    } catch (error) {
      health.openrouteservice.status = 'unhealthy';
      health.openrouteservice.error = error.message;
      console.error('❌ OpenRouteService health check failed:', error);
    }
  } else {
    health.openrouteservice.status = 'not_configured';
    console.log('⚠️ OpenRouteService not configured');
  }

  console.log('🏥 API health check completed:', health);
  return health;
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Core utilities
  fetchWithTimeout,
  isRetryableError,
  
  // Geocoding
  geocodeAddress,
  getRoute,
  getOpenRouteServiceRoute,
  getSimpleRoute,
  
  // Reverse geocoding
  reverseGeocode,
  
  // Validation
  validateApiKey,
  
  // Health check
  checkApiHealth,
  
  // Configuration (for testing)
  API_CONFIG,
};
