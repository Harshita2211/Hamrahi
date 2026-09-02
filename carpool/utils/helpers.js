/**
 * Utility Functions and Helpers
 * Common functions used across the application
 */

/**
 * Async error handler wrapper
 * Eliminates try-catch blocks in route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9\s()+-]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Format date for display
 */
const formatDate = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

/**
 * Format currency
 */
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount || 0);
};

/**
 * Calculate time ago from date
 */
const timeAgo = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, seconds] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
};

/**
 * Validate trip data
 */
const validateTripData = (data) => {
  const errors = [];

  if (!data.origin_text?.trim()) {
    errors.push('Origin address is required');
  }

  if (!data.destination_text?.trim()) {
    errors.push('Destination address is required');
  }

  if (!data.departure_timestamp) {
    errors.push('Departure time is required');
  } else if (new Date(data.departure_timestamp) <= new Date()) {
    errors.push('Departure time must be in the future');
  }

  if (!data.available_seats) {
    errors.push('Number of seats is required');
  } else {
    const seats = parseInt(data.available_seats);
    if (isNaN(seats) || seats < 1 || seats > 7) {
      errors.push('Number of seats must be between 1 and 7');
    }
  }

  if (data.price && (isNaN(parseFloat(data.price)) || parseFloat(data.price) < 0)) {
    errors.push('Price must be a positive number');
  }

  return errors;
};

/**
 * Create pagination metadata
 */
const createPagination = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (currentPage - 1) * pageSize;

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems: total,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    offset,
  };
};

/**
 * Sanitize and validate user input
 */
const sanitizeAndValidate = (data, schema) => {
  const sanitized = {};
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];

    // Required validation
    if (rules.required && (!value || value.toString().trim() === '')) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip validation if field is not required and empty
    if (!rules.required && (!value || value.toString().trim() === '')) {
      continue;
    }

    // Type validation
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${key} must be of type ${rules.type}`);
      continue;
    }

    // Custom validation
    if (rules.validate && !rules.validate(value)) {
      errors.push(rules.message || `${key} is invalid`);
      continue;
    }

    // Sanitize value
    sanitized[key] = rules.sanitize ? rules.sanitize(value) : value;
  }

  return { data: sanitized, errors };
};

export {
  asyncHandler,
  isValidEmail,
  isValidPhone,
  formatDate,
  formatCurrency,
  timeAgo,
  validateTripData,
  createPagination,
  sanitizeAndValidate,
};
