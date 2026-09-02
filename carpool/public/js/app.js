/**
 * Carpool Connect - Main Application JavaScript
 * Handles map utilities, geocoding, and general UI interactions
 */

/* exported geocodeAddress, getRoute, createMap, hasSpecialChar */

// Global configuration
const APP = {
  apiKey: null, // Will be set from environment
  maps: {},
  routes: {},
};

/**
 * Initialize app with API key and setup all functionality
 */
function initializeApp(apiKey) {
  APP.apiKey = apiKey;

  // Setup event listeners
  setupEventListeners();

  // Auto-hide alerts after 5 seconds
  initializeAlerts();

  // Screen reader announcements
  announcePageChanges();

  // Focus management
  manageFocus();

  // Form enhancements
  enhanceForms();

  // Keyboard navigation
  setupKeyboardNavigation();
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
  // Handle form submissions with validation
  document.querySelectorAll('form').forEach((form) => {
    // Enhance validation for common patterns
    const password = form.querySelector('input[name="password"]');
    const passwordConfirm = form.querySelector(
      'input[name="password_confirm"], input[name="confirm_password"], input[name="new_password_confirm"]'
    );
    const email = form.querySelector('input[type="email"]');
    const phone = form.querySelector('input[type="tel"]');

    if (password && passwordConfirm) {
      const checkPasswords = () => {
        if (passwordConfirm.value && password.value !== passwordConfirm.value) {
          passwordConfirm.setCustomValidity('Passwords do not match');
        } else {
          passwordConfirm.setCustomValidity('');
        }
      };
      password.addEventListener('input', checkPasswords);
      passwordConfirm.addEventListener('input', checkPasswords);
    }

    if (email) {
      email.addEventListener('input', () => {
        if (email.value && !validateEmail(email.value)) {
          email.setCustomValidity('Please provide a valid email address');
        } else {
          email.setCustomValidity('');
        }
      });
    }

    if (phone) {
      phone.addEventListener('input', () => {
        // Simple phone format check
        const val = phone.value.trim();
        const ok = val === '' || /^[0-9\s()+-]{7,20}$/.test(val);
        if (!ok) phone.setCustomValidity('Please provide a valid phone number');
        else phone.setCustomValidity('');
      });
    }

    form.addEventListener('submit', function (e) {
      if (!this.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
        // Focus the first invalid element
        const firstInvalid = this.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
      }
      this.classList.add('was-validated');
    });
  });

  // Ensure focus management runs on load
  if (typeof manageFocus === 'function') manageFocus();
}

/**
 * Geocode an address using OpenRouteService
 * @param {string} address - The address to geocode
 * @returns {Promise<Object|null>} - Returns {lat, lng} or null
 */
async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;

  try {
    const resp = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, limit: 1 }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.lat && data.lng) return { lat: data.lat, lng: data.lng, address: data.address };
    if (data.suggestions && data.suggestions.length > 0) {
      const s = data.suggestions[0];
      return { lat: s.coords.lat, lng: s.coords.lng, address: s.address };
    }
  } catch (err) {
    console.error('Geocoding error:', err);
  }

  return null;
}

/**
 * Get route from OpenRouteService directions API
 * @param {Object} origin - Origin coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @returns {Promise<Object|null>} - Returns route object or null
 */
async function getRoute(origin, destination) {
  if (!origin || !destination) return null;

  try {
    const resp = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error('Routing error:', err);
    return null;
  }
}

/**
 * Create and initialize a Leaflet map
 * @param {string} containerId - HTML element ID to mount map
 * @param {Object} center - Center coordinates {lat, lng}
 * @param {number} zoom - Zoom level
 * @returns {Object} - Leaflet map instance
 * India as Center by default
 */
function createMap(containerId, center = { lat: 20.5937, lng: 78.9629 }, zoom = 4) {
  const mapElement = L.map(containerId).setView([center.lat, center.lng], zoom);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(mapElement);

  // Store map instance
  APP.maps[containerId] = mapElement;

  return mapElement;
}

/**
 * Draw a polyline on a map
 * @param {Object} map - Leaflet map instance
 * @param {Array} coordinates - Array of [lat, lng] pairs
 * @param {Object} options - Leaflet polyline options
 * @returns {Object} - Leaflet polyline instance
 */
function drawPolyline(map, coordinates, options = {}) {
  const defaultOptions = {
    color: '#0d6efd',
    weight: 3,
    opacity: 0.8,
  };

  const mergedOptions = { ...defaultOptions, ...options };
  const polyline = L.polyline(coordinates, mergedOptions).addTo(map);

  return polyline;
}

/**
 * Add a marker to a map
 * @param {Object} map - Leaflet map instance
 * @param {Object} coords - Coordinates {lat, lng}
 * @param {string} label - Marker label
 * @param {string} color - Marker color (default, blue, red, etc.)
 * @returns {Object} - Leaflet marker instance
 */
function addMarker(map, coords, label = '', color = 'default') {
  let markerOptions = {};

  if (color === 'red') {
    markerOptions.color = 'red';
  } else if (color === 'green') {
    markerOptions.color = 'green';
  }

  const marker = L.marker([coords.lat, coords.lng], markerOptions).addTo(map).bindPopup(label);

  return marker;
}

/**
 * Fit map bounds to polyline
 * @param {Object} map - Leaflet map instance
 * @param {Object} polyline - Leaflet polyline instance
 */
function fitBounds(map, polyline) {
  if (polyline) {
    map.fitBounds(polyline.getBounds());
  }
}

/**
 * Format distance in human-readable format
 * @param {number} meters - Distance in meters
 * @returns {string} - Formatted distance
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return Math.round(meters) + ' m';
  }
  return (meters / 1000).toFixed(2) + ' km';
}

/**
 * Format duration in human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return hours + ' h ' + minutes + ' min';
  }
  return minutes + ' min';
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (0 = no auto-dismiss)
 */
function showToast(message, type = 'info', duration = 3000) {
  const toastId = 'toast-' + Date.now();
  const bgClass =
    {
      success: 'bg-success',
      error: 'bg-danger',
      warning: 'bg-warning',
      info: 'bg-info',
    }[type] || 'bg-info';

  const toastHTML = `
    <div id="${toastId}" class="toast show toast-fixed" role="alert">
      <div class="toast-header ${bgClass} text-white">
        <strong class="me-auto">Notification</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `;

  const container = document.body;
  container.insertAdjacentHTML('beforeend', toastHTML);

  if (duration > 0) {
    setTimeout(() => {
      const toast = document.getElementById(toastId);
      if (toast) {
        toast.remove();
      }
    }, duration);
  }
}

/**
 * Show loading spinner
 * @param {boolean} show - Show or hide spinner
 */
function showSpinner(show = true) {
  let spinner = document.getElementById('appSpinner');

  if (show) {
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'appSpinner';
      spinner.innerHTML = `
        <div class="spinner-border text-primary spinner-overlay" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      `;
      document.body.appendChild(spinner);
    }
  } else {
    if (spinner) {
      spinner.remove();
    }
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - {isValid: boolean, strength: 'weak'|'medium'|'strong'}
 */
function validatePassword(password) {
  if (password.length < 8) {
    return { isValid: false, strength: 'weak' };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);

  const strength = hasUpperCase && hasLowerCase && hasNumbers ? 'strong' : 'medium';

  return { isValid: true, strength };
}

/**
 * Initialize alert system - auto-hide alerts after 5 seconds
 */
function initializeAlerts() {
  // Auto-hide alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach((alert) => {
    if (alert.classList.contains('alert-dismissible')) {
      setTimeout(() => {
        const closeButton = alert.querySelector('.btn-close');
        if (closeButton) {
          closeButton.click();
        }
      }, 5000);
    }
  });
}

/**
 * Announce page changes for screen readers
 */
function announcePageChanges() {
  // Find elements with data-announce attribute and announce to screen readers
  const announceElements = document.querySelectorAll('[data-announce]');
  announceElements.forEach((element) => {
    const message = element.getAttribute('data-announce');
    if (message) {
      // Create live region for screen reader announcements
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      liveRegion.textContent = message;
      document.body.appendChild(liveRegion);

      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(liveRegion);
      }, 1000);
    }
  });
}

/**
 * Manage focus for better accessibility
 */
function manageFocus() {
  // Skip link functionality
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(skipLink.getAttribute('href'));
      if (target) {
        target.focus();
        target.scrollIntoView();
      }
    });
  }
}

/**
 * Enhance forms with better accessibility
 */
function enhanceForms() {
  // Add required field indicators
  const requiredLabels = document.querySelectorAll('label[for]');
  requiredLabels.forEach((label) => {
    const input = document.querySelector(`#${label.getAttribute('for')}`);
    if (input && input.required) {
      const indicator = document.createElement('span');
      indicator.className = 'required';
      indicator.textContent = ' *';
      indicator.setAttribute('aria-hidden', 'true');
      label.appendChild(indicator);
    }
  });
}

/**
 * Setup keyboard navigation
 */
function setupKeyboardNavigation() {
  // Enhanced keyboard navigation for interactive elements
  document.addEventListener('keydown', (e) => {
    // Escape key to close modals
    if (e.key === 'Escape') {
      const modals = document.querySelectorAll('.modal.show');
      modals.forEach((modal) => {
        const closeButton = modal.querySelector('.btn-close, [data-bs-dismiss="modal"]');
        if (closeButton) {
          closeButton.click();
        }
      });
    }
  });
}

/**
 * Initialize app
 */
/**
 * Initialize app (second, simplified definition removed to avoid duplicate declaration)
 */

// Initialize app when DOM is ready (single entrypoint)
document.addEventListener('DOMContentLoaded', function () {
  const apiKey = document.querySelector('meta[name="api-key"]')?.getAttribute('content') || APP.apiKey || null;
  if (typeof initializeApp === 'function') initializeApp(apiKey);

  // Expose utility functions for testing
  window.CarpoolConnect = {
    drawPolyline,
    addMarker,
    fitBounds,
    formatDistance,
    formatDuration,
    showToast,
    showSpinner,
    validateEmail,
    validatePassword,
  };
});
