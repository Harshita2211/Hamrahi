/**
 * Carpool Connect - Registration Form JavaScript
 * Handles registration form validation and user interactions
 */

document.addEventListener('DOMContentLoaded', function () {
  // Only run on registration page
  if (!document.getElementById('registerForm')) {
    return;
  }

  initializeRegistrationForm();
});

/**
 * Initialize registration form functionality
 */
function initializeRegistrationForm() {
  const form = document.getElementById('registerForm');
  const emailInput = document.getElementById('email');
  const fullNameInput = document.getElementById('full_name');
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('password_confirm');
  const bioInput = document.getElementById('bio');
  const avatarInput = document.getElementById('avatar');
  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitText');
  const submitSpinner = document.getElementById('submitSpinner');
  const bioCharCount = document.getElementById('bioCharCount');
  const avatarPreview = document.getElementById('avatarPreview');

  // Password toggle functionality
  const togglePassword = document.getElementById('togglePassword');
  const passwordIcon = document.getElementById('passwordIcon');
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
  const confirmPasswordIcon = document.getElementById('confirmPasswordIcon');

  // Toggle password visibility
  if (togglePassword && passwordInput && passwordIcon) {
    togglePassword.addEventListener('click', function () {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      passwordIcon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
  }

  if (toggleConfirmPassword && confirmPasswordInput && confirmPasswordIcon) {
    toggleConfirmPassword.addEventListener('click', function () {
      const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
      confirmPasswordInput.type = type;
      confirmPasswordIcon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
  }

  // Bio character counter
  if (bioInput && bioCharCount) {
    bioInput.addEventListener('input', function () {
      const count = this.value.length;
      bioCharCount.textContent = count;

      if (count > 180) {
        bioCharCount.style.color = '#dc3545';
      } else {
        bioCharCount.style.color = '';
      }
    });
  }

  // Avatar preview
  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      avatarPreview.innerHTML = '';

      if (file) {
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          showError('avatar', 'File size must be less than 5MB');
          avatarInput.value = '';
          return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          showError('avatar', 'Please select an image file');
          avatarInput.value = '';
          return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = function (e) {
          avatarPreview.innerHTML = `
            <img src="${e.target.result}" alt="Avatar preview" 
                 class="img-thumbnail rounded" style="max-width: 100px; max-height: 100px;">
          `;
        };
        reader.readAsDataURL(file);
        clearError('avatar');
      }
    });
  }

  // Real-time validation
  if (emailInput) emailInput.addEventListener('blur', () => validateField(emailInput, 'email'));
  if (fullNameInput)
    fullNameInput.addEventListener('blur', () => validateField(fullNameInput, 'fullName'));
  if (phoneInput) phoneInput.addEventListener('blur', () => validateField(phoneInput, 'phone'));
  if (passwordInput)
    passwordInput.addEventListener('blur', () => validateField(passwordInput, 'password'));
  if (confirmPasswordInput)
    confirmPasswordInput.addEventListener('blur', () => validatePasswordMatch());

  // Form submission
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Validate all fields
      const isEmailValid = validateField(emailInput, 'email');
      const isFullNameValid = validateField(fullNameInput, 'fullName');
      const isPhoneValid = validateField(phoneInput, 'phone');
      const isPasswordValid = validateField(passwordInput, 'password');
      const isPasswordMatchValid = validatePasswordMatch();

      if (
        !isEmailValid ||
        !isFullNameValid ||
        !isPhoneValid ||
        !isPasswordValid ||
        !isPasswordMatchValid
      ) {
        return;
      }

      // Show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Creating Account...';
        if (submitSpinner) submitSpinner.classList.remove('d-none');
      }

      // Submit form
      form.submit();
    });
  }
}

/**
 * Validation functions
 */
function validateField(input, fieldType) {
  if (!input) return false;

  const value = input.value.trim();
  let isValid = true;
  let errorMessage = '';

  switch (fieldType) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value) {
        errorMessage = 'Email is required';
        isValid = false;
      } else if (!emailRegex.test(value)) {
        errorMessage = 'Please enter a valid email address';
        isValid = false;
      }
      break;
    }

    case 'fullName':
      if (!value) {
        errorMessage = 'Full name is required';
        isValid = false;
      } else if (value.length < 2) {
        errorMessage = 'Full name must be at least 2 characters';
        isValid = false;
      }
      break;

    case 'phone': {
      const phoneRegex = /^[0-9\s()+-]+$/;
      if (!value) {
        errorMessage = 'Phone number is required';
        isValid = false;
      } else if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
        errorMessage = 'Please enter a valid phone number';
        isValid = false;
      }
      break;
    }

    case 'password':
      if (!value) {
        errorMessage = 'Password is required';
        isValid = false;
      } else if (value.length < 6) {
        errorMessage = 'Password must be at least 6 characters';
        isValid = false;
      }
      break;
  }

  if (isValid) {
    clearError(input.id.replace('_', ''));
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
  } else {
    showError(input.id.replace('_', ''), errorMessage);
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
  }

  return isValid;
}

function validatePasswordMatch() {
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('password_confirm');

  if (!passwordInput || !confirmPasswordInput) return false;

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!confirmPassword) {
    showError('passwordConfirm', 'Please confirm your password');
    confirmPasswordInput.classList.remove('is-valid');
    confirmPasswordInput.classList.add('is-invalid');
    return false;
  }

  if (password !== confirmPassword) {
    showError('passwordConfirm', 'Passwords do not match');
    confirmPasswordInput.classList.remove('is-valid');
    confirmPasswordInput.classList.add('is-invalid');
    return false;
  }

  clearError('passwordConfirm');
  confirmPasswordInput.classList.remove('is-invalid');
  confirmPasswordInput.classList.add('is-valid');
  return true;
}

function showError(fieldId, message) {
  const errorElement = document.getElementById(fieldId + 'Error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

function clearError(fieldId) {
  const errorElement = document.getElementById(fieldId + 'Error');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }
}

// Expose functions for testing
window.RegistrationForm = {
  validateField,
  validatePasswordMatch,
  showError,
  clearError,
  initializeRegistrationForm,
};
