/**
 * Main Routes - Carpool Connect Application
 * 
 * This file contains all the main routes for the Carpool Connect application.
 * It handles the core functionality including trip management, user interactions,
 * and API endpoints for the frontend.
 * 
 * Key Features:
 * - Home page with featured trips
 * - Trip listing with pagination and filtering
 * - Trip creation and management
 * - Trip details and booking
 * - User authentication integration
 * - API endpoints for frontend JavaScript
 * 
 * Routes Included:
 * - GET / - Home page
 * - GET /trips - Trip listing
 * - GET /trips/:id - Trip details
 * - POST /trips - Create new trip
 * - POST /trips/:id/book - Book a seat
 * - API endpoints for AJAX requests
 * 
 * Author: Carpool Connect Team
 * Version: 1.0.0
 */

// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================

import express from 'express';                    // Express.js web framework
import { Router } from 'express';                // Express Router for route handling
import { optionalAuth } from '../middleware/auth.js'; // Authentication middleware (optional)
import supabase from '../utils/supabase.js';       // Supabase database client
import { asyncHandler, validateTripData } from '../utils/helpers.js'; // Utility functions
import { geocodeAddress, reverseGeocode } from '../utils/api.js'; // Geocoding utilities
import { createClient } from '@supabase/supabase-js'; // Supabase client for service role operations

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const router = Router(); // Create Express router instance

// Application constants for pagination and data limits
const TRIPS_LIMIT = 10;        // Maximum number of trips to display per page
const USER_STATS_DAYS = 30;    // Number of days to consider for user statistics

// ============================================================================
// HOME PAGE ROUTE
// ============================================================================

/**
 * GET /
 * Home page route handler
 * 
 * Displays the home page with:
 * - Featured trips (upcoming, popular)
 * - User statistics (if logged in)
 * - Call-to-action for new users
 * 
 * Middleware: optionalAuth (user may or may not be logged in)
 * Response: Renders home page with trips and user data
 */
router.get(
  '/',
  optionalAuth, // Apply optional authentication middleware
  asyncHandler(async (req, res) => {
    const now = new Date().toISOString(); // Current timestamp for queries

    // Fetch featured trips and user statistics in parallel for better performance
    // Promise.allSettled ensures one failure doesn't break the other
    const [tripsResult, userStats] = await Promise.allSettled([
      fetchFeaturedTrips(now),                    // Fetch upcoming and popular trips
      req.user ? fetchUserStats(req.user.id, now) : Promise.resolve(null), // Fetch user stats if logged in
    ]);

    // Handle trip fetching results
    const trips = tripsResult.status === 'fulfilled' ? tripsResult.value : [];
    const tripsError =
      tripsResult.status === 'rejected'
        ? 'Unable to load trips at the moment. Please try again later.'
        : null;

    // Handle user statistics results
    const userStatsData = userStats?.status === 'fulfilled' ? userStats.value : null;

    // Log errors if any
    if (tripsResult.status === 'rejected') {
      console.error('Error fetching trips:', tripsResult.reason);
    }

    if (userStats?.status === 'rejected') {
      console.error('Error fetching user stats:', userStats.reason);
    }

    // Render page
    res.render('index', {
      user: req.user,
      trips,
      userStats: userStatsData,
      error: tripsError,
      currentPage: 'home',
    });
  })
);

// ============================================================================
// TRIPS ROUTES
// ============================================================================

/**
 * GET /trips/create
 * Trip creation page
 */
router.get(
  '/trips/create',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.render('trips/create', {
      user: req.user,
      currentPage: 'trips',
    });
  })
);

/**
 * POST /trips/create
 * Handle trip creation form submission
 */
// ============================================================================
// TRIP CREATION
// ============================================================================

/**
 * Trip validation is centralized in `utils/helpers.js` via `validateTripData(data)`
 */

/**
 * Parse and validate route data
 */
const parseRouteData = (route_geojson) => {
  if (!route_geojson || route_geojson === '{}') {
    return null;
  }

  try {
    const routeData = JSON.parse(route_geojson);
    console.log('📍 Route data parsed:', routeData);
    return routeData;
  } catch (e) {
    console.error('Invalid route data:', e);
    return null;
  }
};

/**
 * Create trip data object for database insertion
 */
const createTripData = async (req, routeData) => {
  const {
    origin_text,
    destination_text,
    departure_timestamp,
    available_seats,
    price,
    description,
  } = req.body;

  const tripData = {
    driver_id: req.user.id,
    origin_text: origin_text.trim(),
    destination_text: destination_text.trim(),
    departure_timestamp: new Date(departure_timestamp).toISOString(),
    available_seats: parseInt(available_seats),
    price: price ? parseFloat(price) : null,
    description: description?.trim() || null,
    created_at: new Date().toISOString(),
  };

  // If explicit route GeoJSON provided, store it (as JSONB)
  if (routeData && routeData.geometry && routeData.geometry.coordinates) {
    const coords = routeData.geometry.coordinates;
    if (coords.length >= 2) {
      tripData.route_geojson = routeData; // store as object so supabase will send JSONB
      console.log('📍 Route data added to trip:', {
        origin: [coords[0][0], coords[0][1]],
        destination: [coords[coords.length - 1][0], coords[coords.length - 1][1]],
        routeDataIncluded: true,
      });
    }
  } else {
    // If no route provided, attempt to geocode origin and destination to create a simple LineString
    try {
      const originGeo = await geocodeAddress(origin_text, null, 1);
      const destGeo = await geocodeAddress(destination_text, null, 1);

      if (originGeo && destGeo && originGeo.lat && destGeo.lat) {
        const simpleRoute = {
          type: 'Feature',
          properties: {
            origin_address: originGeo.address || origin_text,
            destination_address: destGeo.address || destination_text,
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [originGeo.lng, originGeo.lat],
              [destGeo.lng, destGeo.lat],
            ],
          },
        };

        tripData.route_geojson = simpleRoute;
        console.log('🔎 Geocoded simple route added to trip:', simpleRoute.geometry.coordinates);
      }
    } catch (err) {
      console.warn('⚠️ Geocoding failed; skipping route generation:', err.message || err);
    }
  }

  return tripData;
};

/**
 * Handle database insertion with proper error handling
 */
const insertTrip = async (tripData) => {
  try {
    console.log('🔍 Starting database insertion...');
    console.log('📋 Trip data to insert:', {
      has_origin_text: !!tripData.origin_text,
      has_destination_text: !!tripData.destination_text,
      has_departure_timestamp: !!tripData.departure_timestamp,
      has_available_seats: !!tripData.available_seats,
      has_driver_id: !!tripData.driver_id,
      has_route_geojson: !!tripData.route_geojson,
    });

    // Try service role key first (bypasses RLS)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🔑 Using service role key for insertion');
      const serviceRoleSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const result = await serviceRoleSupabase.from('trips').insert([tripData]).select().single();

      console.log('✅ Service role insertion successful');
      return result;
    }

    // Fallback to anon key (may fail due to RLS)
    console.log('⚠️ Using anon key (may fail due to RLS policies)');
    const directSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const result = await directSupabase.from('trips').insert([tripData]).select().single();

    console.log('✅ Anon key insertion successful');
    return result;
  } catch (error) {
    console.error('❌ Database insertion error:', error);
    console.error('📋 Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { error: { message: error.message, code: error.code || 'DB_ERROR' } };
  }
};

/**
 * Handle form submission response
 */
const handleFormResponse = (req, res, success, message, redirectUrl = '/trips/create') => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    if (success) {
      req.flash('success', message);
      return res.redirect('/trips');
    } else {
      req.flash('error', message);
      return res.redirect(redirectUrl);
    }
  }

  // For AJAX requests, return JSON
  return res.status(success ? 201 : 400).json({
    success,
    message,
  });
};

/**
 * POST /trips/create
 * Create a new trip
 */
router.post(
  '/trips/create',
  optionalAuth,
  asyncHandler(async (req, res) => {
    try {
      console.log('📝 Trip creation request:', {
        body: req.body,
        user: req.user ? { id: req.user.id } : null,
        timestamp: new Date().toISOString(),
      });

      // Validate user authentication
      if (!req.user) {
        console.log('❌ User not authenticated');
        return handleFormResponse(
          req,
          res,
          false,
          'Authentication required to create trips. Please sign in first.',
          '/auth/login?redirect=' + encodeURIComponent('/trips/create')
        );
      }

      // Validate trip data
      const validationErrors = validateTripData(req.body);
      if (validationErrors.length > 0) {
        console.log('❌ Validation errors:', validationErrors);
        return handleFormResponse(req, res, false, validationErrors.join(', '));
      }

      // Parse route data (optional)
      const routeData = parseRouteData(req.body.route_geojson);
      console.log('🛣️ Route data parsed:', routeData ? 'PRESENT' : 'MISSING');

      // Create trip data object (may perform geocoding)
      const tripData = await createTripData(req, routeData);
      console.log('💾 Creating trip with data:', {
        driver_id: tripData.driver_id,
        origin_text: tripData.origin_text,
        destination_text: tripData.destination_text,
        departure_timestamp: tripData.departure_timestamp,
        available_seats: tripData.available_seats,
        price: tripData.price,
        description: tripData.description,
        route_geojson: tripData.route_geojson ? 'PRESENT' : 'MISSING',
        created_at: tripData.created_at,
      });

      // Insert trip into database
      console.log('🔍 Attempting database insertion...');
      const result = await insertTrip(tripData);

      if (result.error) {
        console.error('❌ Database insertion failed:', result.error);
        console.error('📋 Error details:', {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
        });

        // Handle specific database errors with detailed messages
        if (result.error.code === 'PGRST204') {
          console.log('📝 Database schema error detected');
          return handleFormResponse(
            req,
            res,
            false,
            'Failed to create trip. The database schema may not support this operation. Please contact support.'
          );
        } else if (result.error.code === '42501') {
          console.log('📝 Authentication error detected');
          return handleFormResponse(
            req,
            res,
            false,
            'Authentication required to create trips. Please sign in first.',
            '/auth/login?redirect=' + encodeURIComponent('/trips/create')
          );
        } else if (result.error.code === 'XX000') {
          console.log('📝 Geometry parsing error detected');
          return handleFormResponse(
            req,
            res,
            false,
            'Route data format error. Please try again with different addresses.'
          );
        } else {
          console.log('📝 General database error detected');
          return handleFormResponse(
            req,
            res,
            false,
            'Failed to create trip. Database error: ' +
              (result.error.message || 'Unknown error') +
              '. Please try again.'
          );
        }
      }

      // Success
      console.log('✅ Trip created successfully!');
      console.log('📋 Trip details:', {
        id: result.data.id,
        driver_id: result.data.driver_id,
        origin_text: result.data.origin_text,
        destination_text: result.data.destination_text,
        route_geojson: result.data.route_geojson ? 'STORED' : 'NOT_STORED',
        created_at: result.data.created_at,
      });

      // Attempt to populate PostGIS geometry columns using RPC
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const svc = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          await svc.rpc('populate_trip_points', { trip_id: result.data.id });
          console.log('✅ populate_trip_points RPC executed');
        } else {
          console.log('⚠️ populate_trip_points RPC skipped (no service role key)');
        }
      } catch (rpcError) {
        console.warn('⚠️ populate_trip_points RPC failed:', rpcError.message || rpcError);
      }

      // Add success flash message
      req.flash(
        'success',
        '🎉 Trip created successfully! Your trip from ' +
          result.data.origin_text +
          ' to ' +
          result.data.destination_text +
          ' has been created.'
      );

      return handleFormResponse(req, res, true, 'Trip created successfully! 🎉', '/trips');
    } catch (error) {
      console.error('❌ Trip creation error:', error);
      console.error('📋 Error stack:', error.stack);

      // Add error flash message
      req.flash(
        'error',
        '❌ Failed to create trip: ' + (error.message || 'Unknown error') + '. Please try again.'
      );

      return handleFormResponse(
        req,
        res,
        false,
        'An unexpected error occurred while creating the trip. Please try again.'
      );
    }
  })
);

// ============================================================================
// TRIP LISTING
// ============================================================================

/**
 * Parse pagination parameters
 */
const parsePaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || TRIPS_LIMIT));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Build trip query filters
 */
const buildTripFilters = (req) => {
  const filters = {};
  const now = new Date().toISOString();

  // Only show future trips by default
  filters.departure_timestamp = { gte: now };

  // Add origin filter if provided
  if (req.query.origin) {
    filters.origin_text = { ilike: `%${req.query.origin}%` };
  }

  // Add destination filter if provided
  if (req.query.destination) {
    filters.destination_text = { ilike: `%${req.query.destination}%` };
  }

  // Add price range filter if provided
  if (req.query.min_price) {
    filters.price = { ...filters.price, gte: parseFloat(req.query.min_price) };
  }
  if (req.query.max_price) {
    filters.price = { ...filters.price, lte: parseFloat(req.query.max_price) };
  }

  return filters;
};

/**
 * Fetch trips with pagination and filters using service role key
 */
const fetchTrips = async (pagination, filters) => {
  try {
    console.log('🔍 Fetching trips with pagination:', pagination, 'filters:', filters);
    
    // Use service role key to bypass RLS for trip listing
    const serviceRoleSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get total count for pagination
    const { count } = await serviceRoleSupabase.from('trips').select('*', { count: 'exact' });

    // Build query with profiles join
    let query = serviceRoleSupabase.from('trips').select(`
      id,
      driver_id,
      origin_text,
      destination_text,
      departure_timestamp,
      available_seats,
      price,
      description,
      route_geojson,
      created_at,
      updated_at,
      profiles (
        id,
        full_name,
        avatar_url,
        phone,
        bio
      )
    `);

    // Apply filters
    if (filters.departure_timestamp?.gte) {
      query = query.gte('departure_timestamp', filters.departure_timestamp.gte);
    }

    if (filters.origin_text?.ilike) {
      query = query.ilike('origin_text', filters.origin_text.ilike);
    }

    if (filters.destination_text?.ilike) {
      query = query.ilike('destination_text', filters.destination_text.ilike);
    }

    if (filters.price?.gte) {
      query = query.gte('price', filters.price.gte);
    }

    if (filters.price?.lte) {
      query = query.lte('price', filters.price.lte);
    }

    // Apply pagination and ordering
    const { data, error } = await query
      .order('departure_timestamp', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit - 1);

    if (error) {
      console.error('❌ Error fetching trips:', error);
      return { data: [], count: 0, error };
    }

    console.log('✅ Trips fetched successfully:', {
      count: count,
      dataLength: data.length,
      firstTrip: data[0]?.id || 'none'
    });

    return { data, count, error: null };
  } catch (error) {
    console.error('❌ Unexpected error in fetchTrips:', error);
    return { data: [], count: 0, error: { message: error.message, code: 'FETCH_ERROR' } };
  }
};

/**
 * GET /trips
 * List all trips with filtering and pagination
 */
router.get(
  '/trips',
  optionalAuth,
  asyncHandler(async (req, res) => {
    try {
      console.log('📋 Trip listing request:', {
        query: req.query,
        user: req.user ? { id: req.user.id } : null,
        timestamp: new Date().toISOString(),
      });

      // Parse pagination parameters
      const pagination = parsePaginationParams(req);

      // Build filters
      const filters = buildTripFilters(req);

      // Fetch trips
      const { data, count, error } = await fetchTrips(pagination, filters);

      if (error) {
        console.error('Error fetching trips:', error);
        return res.status(500).json({
          error: 'Failed to load trips. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }

      // Render response
      const responseData = {
        user: req.user,
        trips: data || [],
        currentPage: 'trips',
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: count,
          totalPages: Math.ceil(count / pagination.limit),
        },
        filters: {
          origin: req.query.origin || '',
          destination: req.query.destination || '',
          min_price: req.query.min_price || '',
          max_price: req.query.max_price || '',
        },
      };

      // Check if this is an API request
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json(responseData);
      }

      // Render HTML template
      res.render('trips/list', responseData);
    } catch (error) {
      console.error('Trips list error:', error);
      return res.status(500).json({
        error: 'Failed to load trips. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

// ============================================================================
// TRIP DETAILS
// ============================================================================

/**
 * Fetch trip by ID
 */
/**
 * Fetch trip by ID with proper error handling
 */
const fetchTripById = async (tripId) => {
  try {
    console.log('🔍 Fetching trip by ID:', tripId);
    
    // Use service role key to bypass RLS for trip details
    const serviceRoleSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await serviceRoleSupabase
      .from('trips')
      .select(`
        id,
        driver_id,
        origin_text,
        destination_text,
        departure_timestamp,
        available_seats,
        price,
        description,
        route_geojson,
        created_at,
        updated_at,
        profiles (
          id,
          full_name,
          avatar_url,
          phone,
          bio
        )
      `)
      .eq('id', tripId)
      .single();

    if (error) {
      console.error('❌ Error fetching trip:', error);
      return { data: null, error };
    }

    console.log('✅ Trip fetched successfully:', {
      id: data.id,
      origin_text: data.origin_text,
      destination_text: data.destination_text,
      has_route_geojson: !!data.route_geojson,
      route_geojson_type: typeof data.route_geojson
    });

    return { data, error: null };
  } catch (error) {
    console.error('❌ Unexpected error in fetchTripById:', error);
    return { data: null, error: { message: error.message, code: 'FETCH_ERROR' } };
  }
};

/**
 * Fetch driver profile by ID
 */
const fetchDriverProfile = async (driverId) => {
  if (!driverId) {
    return { full_name: 'Unknown Driver', phone: null, avatar_url: null, bio: null };
  }

  const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await adminSupabase
    .from('profiles')
    .select('full_name, phone, avatar_url, bio')
    .eq('id', driverId)
    .single();

  if (error || !data) {
    console.log('⚠️ Driver profile not found:', error?.message);
    return { full_name: 'Unknown Driver', phone: null, avatar_url: null, bio: null };
  }

  console.log('✅ Driver profile loaded:', data.full_name);
  return data;
};

/**
 * Format trip data for template with proper route_geojson handling
 */
const formatTripData = (trip, driverProfile) => {
  console.log('🔍 Formatting trip data for template:', {
    tripId: trip.id,
    has_route_geojson: !!trip.route_geojson,
    route_geojson_type: typeof trip.route_geojson
  });

  let routeGeoJson = {};
  let originPoint = null;
  let destinationPoint = null;

  // Handle route_geojson parsing
  if (trip.route_geojson) {
    try {
      if (typeof trip.route_geojson === 'string') {
        // Parse JSON string
        routeGeoJson = JSON.parse(trip.route_geojson);
        console.log('📍 Parsed route_geojson from string');
      } else if (typeof trip.route_geojson === 'object') {
        // Already an object
        routeGeoJson = trip.route_geojson;
        console.log('📍 Using route_geojson object directly');
      }

      // Extract coordinates if geometry exists
      if (routeGeoJson?.geometry?.coordinates && routeGeoJson.geometry.coordinates.length >= 2) {
        const coords = routeGeoJson.geometry.coordinates;
        originPoint = [coords[0][0], coords[0][1]]; // [lng, lat]
        destinationPoint = [coords[coords.length - 1][0], coords[coords.length - 1][1]]; // [lng, lat]
        console.log('📍 Extracted coordinates:', {
          origin: originPoint,
          destination: destinationPoint
        });
      }
    } catch (error) {
      console.error('❌ Error parsing route_geojson:', error);
      routeGeoJson = {};
    }
  }

  return {
    ...trip,
    profiles: driverProfile,
    bookings: [], // No bookings for now
    route_geojson: routeGeoJson,
    origin_point: originPoint,
    destination_point: destinationPoint,
    geometry: routeGeoJson?.geometry || null
  };
};

/**
 * Get address from coordinates using reverse geocoding
 */
const getAddressFromCoordinates = async (lat, lng) => {
  try {
    // Check if OpenRouteService API key is available
    if (process.env.OPENROUTESERVICE_API_KEY) {
      console.log('🔍 Using reverse geocoding for missing route data');
      const address = await reverseGeocode(lat, lng, process.env.OPENROUTESERVICE_API_KEY);

      if (address && address.address) {
        return `${address.address}, ${address.city || ''}, ${address.state || ''}, ${
          address.country || ''
        }`;
      }

      return address && address.address ? address.address : null;
    }
  } catch (error) {
    console.error('❌ Reverse geocoding error:', error);
    return null;
  }
};

/**
 * Validate trip ID
 */
const validateTripId = (tripId) => {
  if (!tripId) {
    return { valid: false, error: 'Trip ID is required' };
  }

  // Check if it's a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tripId)) {
    return { valid: false, error: 'Invalid trip ID format' };
  }

  return { valid: true };
};

/**
 * GET /trips/:id
 * View individual trip details
 */
router.get(
  '/trips/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    try {
      const tripId = req.params.id;
      console.log('🔍 Trip detail request:', {
        tripId,
        user: req.user ? { id: req.user.id } : null,
        timestamp: new Date().toISOString(),
      });

      // Validate trip ID
      const idValidation = validateTripId(tripId);
      if (!idValidation.valid) {
        console.log('❌ Invalid trip ID:', idValidation.error);
        return res.status(400).json({
          error: idValidation.error,
          details: process.env.NODE_ENV === 'development' ? idValidation.error : undefined,
        });
      }

      // Fetch trip
      const { data: trip, error: tripError } = await fetchTripById(tripId);

      if (tripError) {
        console.error('Error fetching trip:', tripError);
        return res.status(500).json({
          error: 'Failed to load trip details. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? tripError.message : undefined,
        });
      }

      if (!trip) {
        console.log('❌ Trip not found:', tripId);
        return res.status(404).json({
          error: 'Trip not found',
          details: `No trip found with ID: ${tripId}`,
        });
      }

      // Check if trip is in the past
      const departureTime = new Date(trip.departure_timestamp);
      const now = new Date();
      if (departureTime < now) {
        console.log('⚠️ Trip is in the past:', departureTime);
      }

      // Fetch driver profile
      const driverProfile = await fetchDriverProfile(trip.driver_id);

      // Format trip data
      const tripData = formatTripData(trip, driverProfile);

      // Extract coordinates from route_geojson if available
      if (tripData.route_geojson && typeof tripData.route_geojson === 'string') {
        try {
          const routeData = JSON.parse(tripData.route_geojson);
          if (routeData.geometry && routeData.geometry.coordinates) {
            const coords = routeData.geometry.coordinates;
            if (coords.length >= 2) {
              tripData.origin_point = [coords[0][0], coords[0][1]]; // [lng, lat]
              tripData.destination_point = [
                coords[coords.length - 1][0],
                coords[coords.length - 1][1],
              ]; // [lng, lat]
              console.log('📍 Extracted coordinates from route_geojson');
            }
          }
        } catch (error) {
          console.error('❌ Failed to parse route_geojson:', error);
        }
      }

      // Add reverse geocoded addresses if route data is missing
      if (!tripData.origin_point && !tripData.destination_point) {
        console.log('🔍 No route data available, attempting reverse geocoding...');

        // Try to geocode origin and destination text to get coordinates
        if (tripData.origin_text && tripData.destination_text) {
          try {
            // Use fetch to call the geocoding API
            const originResponse = await fetch('http://localhost:3000/api/geocode', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ address: tripData.origin_text }),
            });

            const destinationResponse = await fetch('http://localhost:3000/api/geocode', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ address: tripData.destination_text }),
            });

            if (originResponse.ok && destinationResponse.ok) {
              const originCoords = await originResponse.json();
              const destinationCoords = await destinationResponse.json();

              if (
                originCoords.lat &&
                originCoords.lng &&
                destinationCoords.lat &&
                destinationCoords.lng
              ) {
                tripData.origin_point = [originCoords.lng, originCoords.lat];
                tripData.destination_point = [destinationCoords.lng, destinationCoords.lat];

                // Create simple route geometry
                tripData.route_geojson = {
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [originCoords.lng, originCoords.lat],
                      [destinationCoords.lng, destinationCoords.lat],
                    ],
                  },
                  properties: {
                    distance: 0,
                    duration: 0,
                  },
                };

                console.log('✅ Reverse geocoding successful for trip');
                console.log('📍 Origin coords:', originCoords);
                console.log('📍 Destination coords:', destinationCoords);
              }
            }
          } catch (error) {
            console.error('❌ Reverse geocoding failed:', error);
          }
        }
      }

      // Prepare response data
      const responseData = {
        user: req.user,
        trip: tripData,
        currentPage: 'trips',
        isPastTrip: departureTime < now,
        canBook: req.user && req.user.id !== trip.driver_id && departureTime > now,
      };

      // Check if this is an API request
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json(responseData);
      }

      // Render HTML template
      res.render('trips/detail', responseData);
    } catch (error) {
      console.error('Trip detail error:', error);
      return res.status(500).json({
        error: 'Failed to load trip details. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  })
);

/**
 * POST /trips/:id/book
 * Handle trip booking with server-side Supabase client
 */
/**
 * POST /trips/:id/book
 * Finalize the booking process
 */
router.post(
  '/trips/:id/book',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const tripId = req.params.id;

    // 1. Check if user is logged in
    if (!req.user) {
      return res.redirect(`/auth/login?redirect=/trips/${tripId}`);
    }

    try {
      // Use service role to bypass RLS for the transaction
      const serviceRoleSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // 2. Verify seat availability first
      const { data: trip, error: tripError } = await serviceRoleSupabase
        .from('trips')
        .select('available_seats, origin_text, destination_text, departure_timestamp, driver_id')
        .eq('id', tripId)
        .single();

      if (tripError || !trip || trip.available_seats <= 0) {
        return res.redirect(`/trips/${tripId}?error=no_seats`);
      }

      // 3. Create the Booking (CRITICAL FIX: Removed 'booked_at')
      const { data: booking, error: bookingError } = await serviceRoleSupabase
        .from('bookings')
        .insert([{
          trip_id: tripId,
          passenger_id: req.user.id,
          status: 'confirmed',
          seats_booked: 1
          // Let Supabase handle 'created_at' automatically
        }])
        .select()
        .single();

      if (bookingError) {
        console.error('Database Error:', bookingError);
        return res.redirect(`/trips/${tripId}?error=booking_failed&details=${encodeURIComponent(bookingError.message)}`);
      }

      // 4. Update available seats
      await serviceRoleSupabase
        .from('trips')
        .update({ available_seats: trip.available_seats - 1 })
        .eq('id', tripId);

      // 5. Success: Render the confirmation page
      // Pass the data your booking.ejs template expects (from your code screenshots)
      res.render('trips/booking', {
        bookingId: booking.id,
        trip: trip,
        driver: { full_name: 'Driver' }, // You can join profiles here for full details
        user: req.user
      });

    } catch (err) {
      console.error('Booking Exception:', err);
      res.redirect(`/trips/${tripId}?error=server_error`);
    }
  })
);

// ============================================================================
// HEALTH CHECK ROUTE
// ============================================================================

/**
 * GET /health
 * API health check endpoint
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        server: 'healthy',
      },
    };

    // Test database connection
    try {
      const { data, error } = await supabase.from('trips').select('id').limit(1);

      health.services.database = error ? 'unhealthy' : 'healthy';

      if (error) {
        health.status = 'degraded';
        health.database_error = error.message;
      }
    } catch (dbError) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
      health.database_error = dbError.message;
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  })
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch featured trips with available seats (not limited to future trips)
 */
async function fetchFeaturedTrips(now) {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      id,
      origin_text,
      destination_text,
      departure_timestamp,
      available_seats,
      price,
      description,
      driver_id,
      created_at,
      profiles:driver_id (id, full_name, avatar_url, phone)
    `)
    .gt('available_seats', 0)
    .order('departure_timestamp', { ascending: true })
    .limit(TRIPS_LIMIT);

  if (!error && data && data.length > 0) {
    console.log(`✅ Fetched ${data.length} featured trips`);
    return data;
  }

  if (error) console.warn('⚠️ Profile join failed:', error.message);

  // Fallback without profile join
  const { data: plain, error: plainErr } = await supabase
    .from('trips')
    .select('id, origin_text, destination_text, departure_timestamp, available_seats, price, description, driver_id, created_at')
    .gt('available_seats', 0)
    .order('departure_timestamp', { ascending: true })
    .limit(TRIPS_LIMIT);

  if (plainErr) { console.error('❌ Trip fetch error:', plainErr.message); return []; }

  console.log(`✅ Fetched ${plain?.length || 0} featured trips (fallback)`);
  return plain || [];
}

/**
 * Fetch user statistics (upcoming trips and recent bookings)
 */
async function fetchUserStats(userId, now) {
  const thirtyDaysAgo = new Date(Date.now() - USER_STATS_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [driverTripsResult, bookingsResult] = await Promise.allSettled([
    // Get user's trips as driver
    supabase.from('trips').select('id').eq('driver_id', userId).gt('departure_timestamp', now),

    // Get user's recent bookings
    supabase
      .from('bookings')
      .select('id')
      .eq('passenger_id', userId)
      .gt('created_at', thirtyDaysAgo),
  ]);

  const upcomingTrips =
    driverTripsResult.status === 'fulfilled' ? driverTripsResult.value.data?.length || 0 : 0;

  const recentBookings =
    bookingsResult.status === 'fulfilled' ? bookingsResult.value.data?.length || 0 : 0;

  return {
    upcomingTrips,
    recentBookings,
  };
}

export default router;
