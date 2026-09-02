import { isValidEmail, isValidPhone } from './helpers.js';

const MIN_PASSWORD_LENGTH = 6;

function validateLoginInput(email, password) {
  const errors = [];
  if (!email || !isValidEmail(email)) {
    errors.push('Valid email is required');
  }
  if (!password || password.length < 1) {
    errors.push('Password is required');
  }
  return errors;
}

function validateRegistrationInput({ email, password, password_confirm, full_name, phone }) {
  const errors = [];

  if (!email || !isValidEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (password !== password_confirm) {
    errors.push('Passwords do not match');
  }

  if (!full_name || full_name.trim().length < 2) {
    errors.push('Full name is required (minimum 2 characters)');
  }

  if (!phone || !isValidPhone(phone)) {
    errors.push('Valid phone number is required');
  }

  return errors;
}

function validateProfileUpdate({ full_name, phone }) {
  const errors = [];
  if (!full_name || full_name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters');
  }
  if (!phone || !isValidPhone(phone)) {
    errors.push('Valid phone number is required');
  }
  return errors;
}

function validatePasswordChange(
  { current_password, new_password, password_confirm },
  minLength = MIN_PASSWORD_LENGTH
) {
  const errors = [];
  if (!current_password || !new_password) {
    errors.push('All password fields are required');
    return errors;
  }

  if (new_password !== password_confirm) {
    errors.push('New passwords do not match');
  }

  if (new_password.length < minLength) {
    errors.push(`New password must be at least ${minLength} characters`);
  }

  return errors;
}

export {
  validateLoginInput,
  validateRegistrationInput,
  validateProfileUpdate,
  validatePasswordChange,
  MIN_PASSWORD_LENGTH,
};
