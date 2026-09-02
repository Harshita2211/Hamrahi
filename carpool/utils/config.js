/**
 * Configuration validation utility
 * Ensures all required environment variables are set
 */

const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

const optionalVars = ['NODE_ENV', 'PORT', 'SITE_URL', 'OPENROUTESERVICE_API_KEY'];

/**
 * Validate all required environment variables are set
 * @throws {Error} If any required variable is missing
 */
function validateConfig() {
  const missing = [];

  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\n📋 Please set these variables in your .env file');
    console.error('   See .env.example for the required format\n');
    const err = new Error(`Missing required environment variables: ${missing.join(', ')}`);
    err.code = 'MISSING_ENV_VARS';
    throw err;
  }

  // Log configuration status
  console.log('✅ Configuration validated:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   PORT: ${process.env.PORT || 3000}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL.substring(0, 20)}...`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY.substring(0, 10)}...`);

  // Log optional API key status
  if (process.env.OPENROUTESERVICE_API_KEY) {
    console.log(
      `   OPENROUTESERVICE_API_KEY: ${process.env.OPENROUTESERVICE_API_KEY.substring(0, 10)}...`
    );
  } else {
    console.log(`   OPENROUTESERVICE_API_KEY: Not set (using Nominatim OSM)`);
  }
}

/**
 * Get a configuration value with optional default
 * @param {string} key - Environment variable name
 * @param {*} defaultValue - Default value if not set
 * @returns {*} Configuration value
 */
function getConfig(key, defaultValue = null) {
  return process.env[key] !== undefined ? process.env[key] : defaultValue;
}

/**
 * Check if running in production
 * @returns {boolean} True if NODE_ENV is production
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 * @returns {boolean} True if NODE_ENV is development
 */
function isDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

export { validateConfig, getConfig, isProduction, isDevelopment, requiredVars, optionalVars };
