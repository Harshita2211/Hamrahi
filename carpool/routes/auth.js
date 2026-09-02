/**
 * Authentication Routes
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import supabase from '../utils/supabase.js';
import { asyncHandler, isValidEmail } from '../utils/helpers.js';
import { setAuthCookie } from '../utils/auth.js';
import { validateLoginInput, validateRegistrationInput } from '../utils/validators.js';
import multer from 'multer';
import path from 'path';

const router = Router();

// ============================================================================
// CONSTANTS
// ============================================================================

const getSiteUrl = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed'));
    }
  },
});

// ============================================================================
// PAGE ROUTES
// ============================================================================

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { user: null, error: null, currentPage: 'login' });
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { user: null, error: null, currentPage: 'register' });
});

router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { user: req.user || null, error: null, message: null, currentPage: 'forgot-password' });
});

// ============================================================================
// EMAIL CONFIRMATION CALLBACK
// ============================================================================

router.get('/callback', asyncHandler(async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.render('auth/login', { user: null, error: error_description || error, currentPage: 'login' });
  }

  if (!code) {
    return res.render('auth/login', { user: null, error: 'The email confirmation link is invalid or has expired.', currentPage: 'login' });
  }

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    return res.render('auth/login', { user: null, error: exchangeError?.message || 'Unable to confirm your email address.', currentPage: 'login' });
  }

  setAuthCookie(res, data.session.access_token);
  return res.redirect('/');
}));

// ============================================================================
// LOGIN
// ============================================================================

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const validationErrors = validateLoginInput(email, password);
  if (validationErrors.length > 0) {
    return res.render('auth/login', { user: null, error: validationErrors.join(', '), currentPage: 'login' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });

  if (error) {
    return res.render('auth/login', { user: null, error: error.message || 'Login failed', currentPage: 'login' });
  }

  if (!data.session) {
    return res.render('auth/login', { user: null, error: 'No session created. Please try again.', currentPage: 'login' });
  }

  setAuthCookie(res, data.session.access_token);
  res.redirect('/');
}));

// ============================================================================
// REGISTER
// ============================================================================

router.post('/register', upload.single('avatar'), asyncHandler(async (req, res) => {
  const { email, password, password_confirm, full_name, phone, bio } = req.body;
  const avatarFile = req.file;

  // Validate input
  const validationErrors = validateRegistrationInput({ email, password, password_confirm, full_name, phone });
  if (validationErrors.length > 0) {
    return res.render('auth/register', { user: null, error: validationErrors.join(', '), currentPage: 'register' });
  }

  const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let avatarUrl = null;

  // Upload avatar if provided
  if (avatarFile) {
    const fileExt = path.extname(avatarFile.originalname);
    const fileName = `avatar-${Date.now()}${fileExt}`;

    const { error: uploadError } = await adminSupabase.storage
      .from('avatars')
      .upload(fileName, avatarFile.buffer, {
        contentType: avatarFile.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError.message);
    } else {
      const { data: urlData } = adminSupabase.storage.from('avatars').getPublicUrl(fileName);
      avatarUrl = urlData?.publicUrl || null;
    }
  }

  // Use standard signUp — this is the ONLY method that sends a confirmation email
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.toLowerCase().trim(),
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: {
        full_name: full_name.trim(),
        phone: phone.trim(),
        bio: bio?.trim() || '',
        avatar_url: avatarUrl,
      },
    },
  });

  if (authError) {
    console.error('Registration error:', authError.message);
    return res.render('auth/register', { user: null, error: authError.message || 'Registration failed', currentPage: 'register' });
  }

  // Manually insert profile using service role (in case DB trigger is missing/broken)
  if (authData.user) {
    const { error: profileError } = await adminSupabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: full_name.trim(),
      phone: phone.trim(),
      bio: bio?.trim() || '',
      avatar_url: avatarUrl,
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile creation error:', profileError.message);
      // Non-fatal — user can still confirm email and log in
    }
  }

  res.render('auth/verify-email', { user: null, email, currentPage: 'verify-email' });
}));

// ============================================================================
// LOGOUT
// ============================================================================

router.post('/logout', asyncHandler(async (req, res) => {
  try {
    if (req.token) await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.error('Logout error:', e.message);
  } finally {
    res.clearCookie('sb_access_token');
    res.redirect('/');
  }
}));

// ============================================================================
// FORGOT PASSWORD
// ============================================================================

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.render('auth/forgot-password', { user: null, error: 'Valid email is required', message: null, currentPage: 'forgot-password' });
  }

  await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
    redirectTo: `${getSiteUrl()}/auth/reset-password`,
  });

  // Always show success to prevent email enumeration
  res.render('auth/reset-sent', { user: null, email, currentPage: 'reset-sent' });
}));

// ============================================================================
// ERROR HANDLER — must be last
// ============================================================================

router.use((err, req, res, next) => {
  console.error('Auth route error:', err.message);

  if (err instanceof multer.MulterError) {
    return res.render('auth/register', { user: null, error: `File upload error: ${err.message}`, currentPage: 'register' });
  }

  res.render('auth/register', { user: null, error: err.message || 'An unexpected error occurred', currentPage: 'register' });
});

export default router;
