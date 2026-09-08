/**
 * Trip Creation JavaScript
 * Handles map loading, address autocomplete, and route calculation for trip creation
 */

// Global variables

let mapElement;
let originCoords = null;
let destinationCoords = null;
let routePolyline = null;
let originMarker = null;
let destinationMarker = null;
let suggestionTimeout;
let routeDataWatcher;
/* exported currentRouteData, routeDataWatcher */

// API configuration - Nominatim OSM doesn't require API key
const hasApiKey = true; // Always true for Nominatim

/**
 * Initialize map with better default center (India)
 */
function initializeTripMap() {
  try {
    console.log('🗺️ Initializing trip map...');

    // Check if Leaflet is available
    if (typeof L === 'undefined') {
      console.error('❌ Leaflet library not loaded');
      showWarning('Map library failed to load. Please refresh the page.');
      return;
    }

    // Check if map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error('❌ Map container not found');
      return;
    }

    console.log('✅ Map container found, creating map...');

    mapElement = L.map('map').setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapElement);

    // Add scale control
    L.control.scale().addTo(mapElement);

    // Initialize map with user location if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('📍 User location found:', position.coords);
          mapElement.setView([position.coords.latitude, position.coords.longitude], 10);
          // Add user location marker
          L.marker([position.coords.latitude, position.coords.longitude], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="background: #007bff; border: 2px solid white; border-radius: 50%; width: 12px; height: 12px;"></div>',
              iconSize: [12, 12],
            }),
          })
            .addTo(mapElement)
            .bindPopup('Your current location');
        },
        (error) => {
          console.log('📍 Geolocation not available:', error);
        }
      );
    }

    console.log('✅ Map initialized successfully');
  } catch (error) {
    console.error('❌ Map initialization error:', error);
    showWarning('Map failed to load. Please refresh page.');
  }
}

/**
 * Enhanced address autocomplete with debouncing
 */
function createAutocomplete(inputElement, type) {
  let suggestionTimeout;

  inputElement.addEventListener('input', function () {
    clearTimeout(suggestionTimeout);
    const value = this.value.trim();

    if (value.length < 3) {
      hideSuggestions(type);
      return;
    }

    suggestionTimeout = setTimeout(() => {
      if (hasApiKey) {
        showSuggestions(type, value);
      }
    }, 300);
  });

  inputElement.addEventListener('focus', function () {
    if (this.value.trim().length >= 3) {
      showSuggestions(type, this.value.trim());
    }
  });

  inputElement.addEventListener('blur', function () {
    setTimeout(() => hideSuggestions(type), 200);
  });
}

// Add event listeners for real-time route data updates
const originInput = document.getElementById('origin_text');
const destinationInput = document.getElementById('destination_text');

originInput.addEventListener('input', function () {
  clearTimeout(suggestionTimeout);
  const value = this.value.trim();

  if (value.length >= 3) {
    hideSuggestions('origin');
    // Trigger route calculation when both addresses are entered
    if (destinationInput.value.trim().length >= 3) {
      debouncedGeocodeOrigin();
    }
  }

  suggestionTimeout = setTimeout(() => {
    if (hasApiKey) {
      showSuggestions('origin', value);
    }
  }, 300);
});

originInput.addEventListener('focus', function () {
  if (this.value.trim().length >= 3) {
    showSuggestions('origin', this.value.trim());
  }
});

originInput.addEventListener('blur', function () {
  setTimeout(() => hideSuggestions('origin'), 200);
});

destinationInput.addEventListener('input', function () {
  clearTimeout(suggestionTimeout);
  const value = this.value.trim();

  if (value.length >= 3) {
    hideSuggestions('destination');
    // Trigger route calculation when both addresses are entered
    if (originInput.value.trim().length >= 3) {
      debouncedGeocodeOrigin();
    }
  }

  suggestionTimeout = setTimeout(() => {
    if (hasApiKey) {
      showSuggestions('destination', value);
    }
  }, 300);
});

destinationInput.addEventListener('focus', function () {
  if (this.value.trim().length >= 3) {
    showSuggestions('destination', this.value.trim());
  }
});

destinationInput.addEventListener('blur', function () {
  setTimeout(() => hideSuggestions('destination'), 200);
});

// Auto-update route when both points are set
const updateRouteOnDataChange = () => {
  if (originCoords && destinationCoords) {
    updateRoute();
  }
};

// Watch for route data changes — stop as soon as data is present
routeDataWatcher = setInterval(() => {
  const newRouteData = document.getElementById('route_geojson').value;
  if (newRouteData && newRouteData !== '{}') {
    clearInterval(routeDataWatcher);
    routeDataWatcher = null;
  }
}, 500);

/**
 * Create suggestion containers
 */
function createSuggestionContainer(type) {
  const container = document.createElement('div');
  container.id = `${type}_suggestions`;
  container.className = 'autocomplete-suggestions';
  container.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-top: none;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
  `;
  return container;
}

/**
 * Show address suggestions
 */
async function showSuggestions(type, query) {
  hideSuggestions(type);

  try {
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: query, limit: 5 }),
    });

    if (!response.ok) return;

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.suggestions || data.suggestions.length === 0) return;

    const container =
      document.getElementById(`${type}_suggestions`) || createSuggestionContainer(type);
    const inputElement =
      type === 'origin'
        ? document.getElementById('origin_text')
        : document.getElementById('destination_text');

    // Position container below input
    const rect = inputElement.getBoundingClientRect();
    container.style.top = `${rect.height + 2}px`;

    // Populate suggestions
    container.innerHTML = data.suggestions
      .map(
        (suggestion) => `
      <div class="suggestion-item" data-coords='${JSON.stringify(
        suggestion.coords
      )}' data-address='${suggestion.address}'>
        <div class="suggestion-main">${suggestion.address}</div>
        ${suggestion.county ? `<div class="suggestion-secondary">${suggestion.county}</div>` : ''}
      </div>
    `
      )
      .join('');

    inputElement.parentNode.style.position = 'relative';
    inputElement.parentNode.appendChild(container);
    container.style.display = 'block';

    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach((item) => {
      item.addEventListener('click', function () {
        const coords = JSON.parse(this.dataset.coords);
        const address = this.dataset.address;

        inputElement.value = address;
        hideSuggestions(type);

        if (type === 'origin') {
          originCoords = coords;
          if (originMarker) originMarker.remove();
          originMarker = createMapMarker(mapElement, coords, '📍 Origin', 'green');
        } else {
          destinationCoords = coords;
          if (destinationMarker) destinationMarker.remove();
          destinationMarker = createMapMarker(mapElement, coords, '📍 Destination', 'red');
        }

        // Update map view
        mapElement.setView([coords.lat, coords.lng], 13);

        // Auto-update route if both points are set
        if (originCoords && destinationCoords) {
          updateRoute();
        }
      });
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    showMessage(`Failed to get suggestions: ${error.message}. Please try again.`, 'error');
  }
}

/**
 * Hide suggestions
 */
function hideSuggestions(type) {
  const container = document.getElementById(`${type}_suggestions`);
  if (container) {
    container.style.display = 'none';
  }
}

/**
 * Enhanced route calculation with error handling
 */
async function updateRoute() {
  if (!originCoords || !destinationCoords) return;

  if (!hasApiKey) {
    showMessage('Route calculation is not available without API configuration.', 'warning');
    return;
  }

  try {
    showMessage('Calculating route...', 'info');

    const response = await fetch('/api/route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: originCoords,
        destination: destinationCoords,
      }),
    });

    if (!response.ok) {
      throw new Error(`Route calculation failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Update display
    document.getElementById('distance').textContent = (data.distance / 1000).toFixed(2) + ' km';
    document.getElementById('duration').textContent = Math.round(data.duration / 60) + ' min';

    // Store GeoJSON
    document.getElementById('route_geojson').value = JSON.stringify(data);

    // Draw polyline on map
    if (routePolyline) mapElement.removeLayer(routePolyline);

    const coords = data.geometry.coordinates.map((c) => [c[1], c[0]]);
    routePolyline = L.polyline(coords, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.8,
      smoothFactor: 1,
    }).addTo(mapElement);

    mapElement.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });

    hideMessage();
    showMessage('Route calculated successfully!', 'success');
  } catch (error) {
    console.error('Routing error:', error);
    showMessage(`Failed to calculate route: ${error.message}. Please try again.`, 'error');
  }
}

/**
 * Debounce input changes
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create map markers (separate function to avoid conflicts)
 */
function createMapMarker(map, coords, label, color) {
  const icon = L.divIcon({
    html: label,
    iconSize: [30, 30],
    className: 'custom-marker',
  });

  return L.marker([coords.lat, coords.lng], { icon }).addTo(map).bindPopup(label);
}

/**
 * Geocode address using API
 */
async function geocodeAddress(address) {
  if (!address.trim()) {
    return null;
  }

  try {
    showMessage('🔍 Geocoding address...', 'info');

    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    hideMessage();
    return data.coords || data;
  } catch (error) {
    console.error('Geocoding error:', error);
    showMessage(
      `Failed to geocode address: ${error.message}. Please try a more specific address.`,
      'error'
    );
    return null;
  }
}

/**
 * Message display functions
 */
function showMessage(message, type) {
  hideMessage(); // Clear existing messages

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    <i class="fas fa-${
      type === 'error'
        ? 'exclamation-triangle'
        : type === 'warning'
        ? 'exclamation-circle'
        : type === 'success'
        ? 'check-circle'
        : 'info-circle'
    } me-2"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  const form = document.getElementById('createTripForm');
  form.parentNode.insertBefore(alertDiv, form);
}

function showWarning(message) {
  const warningDiv = document.createElement('div');
  warningDiv.className = 'alert alert-warning alert-dismissible fade show mt-3';
  warningDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle me-2"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  const mapContainer = document.getElementById('map').parentNode;
  mapContainer.appendChild(warningDiv);
}

function hideMessage() {
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach((alert) => {
    if (!alert.classList.contains('alert-permanent')) {
      alert.remove();
    }
  });
}

/**
 * Initialize trip creation functionality
 */
function initializeTripCreation() {
  console.log('🚀 Initializing trip creation functionality...');

  try {
    // Get DOM elements
    const originInput = document.getElementById('origin_text');
    const destinationInput = document.getElementById('destination_text');
    const submitBtn = document.getElementById('submitBtn');

    if (!originInput || !destinationInput || !submitBtn) {
      console.error('❌ Required form elements not found');
      return;
    }

    console.log('✅ Form elements found');

    // Initialize map
    initializeTripMap();

    // Setup autocomplete for both inputs
    createAutocomplete(originInput, 'origin');
    createAutocomplete(destinationInput, 'destination');

    // Add event listeners for geocoding
    originInput.addEventListener('input', debouncedGeocodeOrigin);
    destinationInput.addEventListener('input', debouncedGeocodeDestination);

    // Form validation
    const form = document.getElementById('createTripForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        console.log('🚀 Form submission started');

        // Basic validation - ensure required fields are filled
        if (!originInput.value.trim()) {
          e.preventDefault();
          showMessage('Please enter an origin address.', 'error');
          originInput.focus();
          return;
        }

        if (!destinationInput.value.trim()) {
          e.preventDefault();
          showMessage('Please enter a destination address.', 'error');
          destinationInput.focus();
          return;
        }

        const departureInput = document.getElementById('departure_timestamp');
        const seatsInput = document.getElementById('available_seats');

        if (!departureInput.value) {
          e.preventDefault();
          showMessage('Please select a departure date and time.', 'error');
          departureInput.focus();
          return;
        }

        if (!seatsInput.value || parseInt(seatsInput.value) < 1) {
          e.preventDefault();
          showMessage('Please enter at least 1 available seat.', 'error');
          seatsInput.focus();
          return;
        }

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating Trip...';

        // Check coordinates (optional but recommended)
        if (!originCoords || !destinationCoords) {
          console.log('⚠️ No coordinates available, but allowing submission');
          showMessage('Route calculation is optional. Submitting without route data.', 'warning');
        }

        // Check route data (optional)
        const routeData = document.getElementById('route_geojson').value;
        if (!routeData || routeData === '{}') {
          console.log('⚠️ No route data available, but allowing submission');
          showMessage('Route calculation is optional. Submitting without route data.', 'warning');
        }

        // Prevent submission if critical data is missing
        if (
          !originInput.value.trim() ||
          !destinationInput.value.trim() ||
          !departureInput.value ||
          !seatsInput.value ||
          parseInt(seatsInput.value) < 1
        ) {
          e.preventDefault();
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-plus-circle me-2"></i>Create Trip';
          showMessage('Please fill in all required fields.', 'error');
          return;
        }

        console.log('✅ Form validation passed, submitting...');

        // Create form data object
        const formData = {
          origin_text: originInput.value.trim(),
          destination_text: destinationInput.value.trim(),
          departure_timestamp: departureInput.value,
          available_seats: seatsInput.value,
          price: document.getElementById('price').value,
          description: document.getElementById('description').value.trim(),
          route_geojson: routeData, // Use the calculated route data
        };

        console.log('📝 Submitting form data:', formData);
      });
    } else {
      console.error('❌ Form not found');
    }

    console.log('✅ Trip creation initialization complete');
  } catch (error) {
    console.error('❌ Initialization error:', error);
  }
}

/**
 * Geocode address with debouncing
 */
const debouncedGeocodeOrigin = debounce(async () => {
  const originInput = document.getElementById('origin_text');
  if (originInput && originInput.value.trim()) {
    const coords = await geocodeAddress(originInput.value);
    if (coords) {
      originCoords = coords;
      if (originMarker) originMarker.remove();
      originMarker = createMapMarker(mapElement, coords, '📍 Origin', 'green');
      updateRoute();
    }
  }
}, 1000);

const debouncedGeocodeDestination = debounce(async () => {
  const destinationInput = document.getElementById('destination_text');
  if (destinationInput && destinationInput.value.trim()) {
    const coords = await geocodeAddress(destinationInput.value);
    if (coords) {
      destinationCoords = coords;
      if (destinationMarker) destinationMarker.remove();
      destinationMarker = createMapMarker(mapElement, coords, '📍 Destination', 'red');
      updateRoute();
    }
  }
}, 1000);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeTripCreation);
