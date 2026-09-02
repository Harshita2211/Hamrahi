/**
 * Authentication Routes
 * Clean, organized route handlers for user authentication
 */

import { Router } from 'express';
import supabase from '../utils/supabase.js';
import { asyncHandler, isValidEmail } from '../utils/helpers.js';
import { setAuthCookie } from '../utils/auth.js';
import { validateLoginInput, validateRegistrationInput } from '../utils/validators.js';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Add global error handler to catch all errors
router.use((err, req, res, next) => {
  console.error('Global auth error:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    status: err.status,
  });

  // If it's a multer error, show specific message
  if (err instanceof multer.MulterError) {
    return res.render('auth/register', {
      user: null,
      error: `File upload error: ${err.message}`,
      currentPage: 'register',
    });
  }

  // Other errors
  res.render('auth/register', {
    user: null,
    error: err.message || 'An unexpected error occurred',
    currentPage: 'register',
  });
});

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const getSiteUrl = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed'));
    }
  },
});

// Simple avatar upload test route
router.post(
  '/test-upload-simple',
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    console.log('🧪 SIMPLE AVATAR UPLOAD TEST');
    console.log('📁 File received:', req.file ? 'YES' : 'NO');

    if (!req.file) {
      return res.json({ error: 'No file received' });
    }

    try {
      // Test basic Supabase connection
      console.log('🔌 Testing Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      console.log('🔌 CONNECTION TEST:', { testData, testError });

      if (testError) {
        return res.json({ error: `Database connection failed: ${testError.message}` });
      }

      // Test storage bucket access
      console.log('🪣 Testing storage bucket access...');
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

      console.log('🪣 BUCKET TEST:', { buckets, bucketError });

      if (bucketError) {
        return res.json({ error: `Storage access failed: ${bucketError.message}` });
      }

      // Test simple file upload
      const fileName = `test-${Date.now()}.jpg`;
      console.log('📤 Testing file upload:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
        });

      console.log('📤 UPLOAD TEST RESULT:', { uploadData, uploadError });

      if (uploadError) {
        return res.json({
          error: `Upload failed: ${uploadError.message}`,
          details: uploadError,
          code: uploadError.code,
        });
      }

      // Clean up test file
      await supabase.storage.from('avatar').remove([fileName]);

      return res.json({
        success: true,
        message: 'Upload test successful!',
        fileName: fileName,
      });
    } catch (error) {
      console.error('🧪 TEST ERROR:', error);
      return res.json({
        error: `Test failed: ${error.message}`,
        stack: error.stack,
      });
    }
  })
);

// Test route for avatar upload debugging
router.post(
  '/test-avatar',
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    console.log('=== AVATAR UPLOAD TEST ===');
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);

    if (!req.file) {
      return res.json({ error: 'No file received' });
    }

    try {
      const { data, error } = await supabase.storage
        .from('avatar')
        .upload('test-file.jpg', req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
        });

      console.log('Test upload result:', { data, error });

      if (error) {
        console.error('Test upload error:', error);
        return res.json({ error: error.message });
      }

      res.json({ success: true, data: 'Upload test successful' });
    } catch (err) {
      console.error('Test upload catch:', err);
      res.json({ error: err.message });
    }
  })
);

// ============================================================================
// AUTHENTICATION PAGE ROUTES
// ============================================================================

/**
 * GET /auth/login
 * Show login page
 */
router.get('/login', (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }

  res.render('auth/login', {
    user: null,
    error: null,
    currentPage: 'login',
  });
});

/**
 * GET /auth/register
 * Show registration page
 */
router.get('/register', (req, res) => {
  if (req.user) {
    return res.redirect('/');
  }

  res.render('auth/register', {
    user: null,
    error: null,
    currentPage: 'register',
  });
});

/**
 * GET /auth/forgot-password
 * Show forgot password page
 */
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', {
    user: req.user || null,
    error: null,
    message: null,
    currentPage: 'forgot-password',
  });
});

/**
 * GET /auth/callback
 * Exchange the confirmation code for a session and sign the user in.
 */
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.render('auth/login', {
        user: null,
        error: error_description || error,
        currentPage: 'login',
      });
    }

    if (!code) {
      return res.render('auth/login', {
        user: null,
        error: 'The email confirmation link is invalid or has expired.',
        currentPage: 'login',
      });
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data.session) {
      return res.render('auth/login', {
        user: null,
        error: exchangeError?.message || 'Unable to confirm your email address.',
        currentPage: 'login',
      });
    }

    setAuthCookie(res, data.session.access_token);
    return res.redirect('/');
  })
);

// ============================================================================
// AUTHENTICATION ACTION ROUTES
// ============================================================================

/**
 * POST /auth/login
 * Handle user login
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    const validationErrors = validateLoginInput(email, password);
    if (validationErrors.length > 0) {
      return res.render('auth/login', {
        user: null,
        error: validationErrors.join(', '),
        currentPage: 'login',
      });
    }

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      console.error('Login error:', error);
      return res.render('auth/login', {
        user: null,
        error: error.message || 'Login failed',
        currentPage: 'login',
      });
    }

    if (!data.session) {
      return res.render('auth/login', {
        user: null,
        error: 'No session created',
        currentPage: 'login',
      });
    }

    // Set secure cookie
    setAuthCookie(res, data.session.access_token);

    res.redirect('/');
  })
);

/**
 * POST /auth/register
 * Handle user registration
 */
router.post(
  '/register',
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    try {
      console.log('🔥 REGISTRATION ROUTE HIT!');
      console.log('📋 Request body:', req.body);
      console.log('📁 File received:', req.file ? 'YES' : 'NO');
      console.log('📊 File details:', req.file);
      console.log('⏱️ Timestamp:', new Date().toISOString());

      const { email, password, password_confirm, full_name, phone, bio } = req.body;
      const avatarFile = req.file;

      // Validate input
      console.log('🔍 VALIDATING INPUT...');
      const validationErrors = validateRegistrationInput({
        email,
        password,
        password_confirm,
        full_name,
        phone,
      });

      console.log('📝 Validation errors:', validationErrors);

      if (validationErrors.length > 0) {
        console.log('❌ VALIDATION FAILED:', validationErrors);
        return res.render('auth/register', {
          user: null,
          error: validationErrors.join(', '),
          currentPage: 'register',
        });
      }

      console.log('✅ VALIDATION PASSED!');

      let avatarUrl = null;

      // Upload avatar to Supabase Storage if provided
      if (avatarFile) {
        console.log('🚀 STARTING AVATAR UPLOAD PROCESS');
        console.log('Avatar file received:', {
          originalname: avatarFile.originalname,
          mimetype: avatarFile.mimetype,
          size: avatarFile.size,
          buffer: avatarFile.buffer ? 'Buffer present' : 'No buffer',
        });

        try {
          console.log('📦 STEP 1: Discovering available buckets...');
          const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

          if (bucketsError) {
            console.error('❌ BUCKET DISCOVERY ERROR:', bucketsError);
          } else {
            console.log('✅ Available buckets:', buckets);
          }

          console.log('📁 STEP 2: Preparing file upload...');
          const fileExt = path.extname(avatarFile.originalname);
          const fileName = `avatar-${Date.now()}${fileExt}`;
          const filePath = fileName; // Simple flat structure

          console.log('📤 STEP 3: Uploading avatar to Supabase...', {
            fileName: fileName,
            filePath: filePath,
            fileSize: avatarFile.size,
            fileType: avatarFile.mimetype,
            bucket: 'avatar',
            supabaseUrl: process.env.SUPABASE_URL ? 'CONFIGURED' : 'MISSING',
            supabaseKey: process.env.SUPABASE_ANON_KEY ? 'CONFIGURED' : 'MISSING',
          });

          // Test network connectivity first
          console.log('🌐 TESTING NETWORK CONNECTIVITY...');
          try {
            const testResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
              method: 'GET',
              headers: {
                apikey: process.env.SUPABASE_ANON_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
              },
            });
            console.log('🌐 NETWORK TEST RESULT:', {
              status: testResponse.status,
              ok: testResponse.ok,
              statusText: testResponse.statusText,
            });
          } catch (networkError) {
            console.error('❌ NETWORK TEST FAILED:', networkError);
            return res.render('auth/register', {
              user: null,
              error: `Network connectivity issue: ${networkError.message}`,
              currentPage: 'register',
            });
          }

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatar')
            .upload(filePath, avatarFile.buffer, {
              contentType: avatarFile.mimetype,
              upsert: false,
              cacheControl: '3600',
            });

          console.log('📊 UPLOAD RESULT:', { uploadData, uploadError });

          if (uploadError) {
            console.error('❌ UPLOAD FAILED:', uploadError);
            console.error('🔍 DETAILED ERROR ANALYSIS:', {
              errorMessage: uploadError.message,
              errorCode: uploadError.code,
              errorStatus: uploadError.status,
              errorDetails: uploadError.details,
              errorContext: uploadError.context,
              isNetworkError:
                uploadError.message?.includes('fetch') || uploadError.message?.includes('network'),
              isTimeoutError: uploadError.message?.includes('timeout'),
              isAuthError:
                uploadError.message?.includes('unauthorized') ||
                uploadError.message?.includes('forbidden'),
            });

            // Provide specific error messages based on error type
            let userMessage = 'Failed to upload avatar. Please try again.';

            if (
              uploadError.message?.includes('fetch') ||
              uploadError.message?.includes('network')
            ) {
              userMessage =
                'Network connection error. Please check your internet connection and try again.';
            } else if (uploadError.message?.includes('timeout')) {
              userMessage = 'Upload timeout. Please try again with a smaller image.';
            } else if (
              uploadError.message?.includes('unauthorized') ||
              uploadError.message?.includes('forbidden')
            ) {
              userMessage = 'Permission denied. Please check storage bucket permissions.';
            } else if (uploadError.message?.includes('bucket')) {
              userMessage = 'Storage bucket error. Please contact support.';
            }

            return res.render('auth/register', {
              user: null,
              error: userMessage,
              currentPage: 'register',
            });
          }

          console.log('✅ UPLOAD SUCCESSFUL!');

          // Get signed URL for the uploaded avatar
          console.log('🔗 ATTEMPTING SIGNED URL GENERATION...');
          console.log('📁 File path for signed URL:', filePath);
          console.log('🪣 Bucket: avatar');
          console.log('⏰ Expiry: 31536000 (1 year)');

          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('avatar')
            .createSignedUrl(filePath, 31536000); // 1 year expiry

          console.log('🔗 SIGNED URL RESULT:', {
            signedUrlData,
            signedUrlError,
            filePath,
            signedUrlDataKeys: signedUrlData ? Object.keys(signedUrlData) : 'null',
            signedUrlType: typeof signedUrlData,
          });

          if (signedUrlError || !signedUrlData || !signedUrlData.signedUrl) {
            console.error('❌ SIGNED URL ERROR:', {
              error: signedUrlError,
              message: signedUrlError?.message,
              code: signedUrlError?.code,
              details: signedUrlError?.details,
              bucket: 'avatar',
              filePath: filePath,
              signedUrlData: signedUrlData,
            });

            // Try fallback to public URL
            console.log('🔄 FALLBACK: Trying public URL...');
            try {
              const { data: publicUrlData, error: publicUrlError } = await supabase.storage
                .from('avatar')
                .getPublicUrl(filePath);

              console.log('🌐 PUBLIC URL RESULT:', { publicUrlData, publicUrlError });

              if (publicUrlError || !publicUrlData || !publicUrlData.publicUrl) {
                console.error('❌ PUBLIC URL ALSO FAILED:', publicUrlError);
                return res.render('auth/register', {
                  user: null,
                  error: 'Failed to get avatar URL. Please try again.',
                  currentPage: 'register',
                });
              }

              avatarUrl = publicUrlData.publicUrl;
              console.log('✅ FALLBACK SUCCESS! Using public URL:', avatarUrl);
            } catch (fallbackError) {
              console.error('❌ FALLBACK FAILED:', fallbackError);
              return res.render('auth/register', {
                user: null,
                error: 'Failed to get avatar URL. Please try again.',
                currentPage: 'register',
              });
            }
          } else {
            avatarUrl = signedUrlData.signedUrl;
            console.log('🎉 SIGNED URL SUCCESS! URL:', avatarUrl);
          }
        } catch (storageError) {
          console.error('❌ STORAGE OPERATION ERROR:', {
            name: storageError.name,
            message: storageError.message,
            code: storageError.code,
            status: storageError.status,
            stack: storageError.stack,
            fullError: JSON.stringify(storageError, null, 2),
          });
          console.error('🆘 ERROR STACK TRACE:');
          console.error(storageError.stack);

          return res.render('auth/register', {
            user: null,
            error: `Storage error: ${storageError.message}`,
            currentPage: 'register',
          });
        }
      }

      // Create user account with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: full_name.trim(),
            phone: phone.trim(),
            bio: bio?.trim() || '',
            avatar_url: avatarUrl,
          },
          emailRedirectTo: `${getSiteUrl()}/auth/callback`,
        },
      });

      if (authError) {
        console.error('Registration error:', authError);
        // Clean up uploaded avatar if auth fails
        if (avatarUrl) {
          try {
            // Extract file name from signed URL (simplified for flat structure)
            const urlParts = avatarUrl.split('/');
            const fileName = urlParts.pop(); // Just get the filename
            console.log('Cleaning up avatar file:', fileName);
            await supabase.storage.from('avatar').remove([fileName]);
          } catch (cleanupError) {
            console.warn('Failed to clean up avatar:', cleanupError);
          }
        }

        return res.render('auth/register', {
          user: null,
          error: authError.message || 'Registration failed',
          currentPage: 'register',
        });
      }

      // Profile is created automatically by trigger in handle_new_user()
      // The trigger runs with SECURITY DEFINER and creates the profile with data from raw_user_meta_data
      if (authData.user) {
        console.log('✅ USER CREATED SUCCESSFULLY');
        console.log('🆔 User ID:', authData.user.id);
        console.log('📧 Email:', authData.user.email);
        console.log('💡 Profile will be created automatically by database trigger');
        console.log('📝 Metadata passed to trigger:', {
          full_name: full_name.trim(),
          phone: phone.trim(),
          bio: bio?.trim() || '',
          avatar_url: avatarUrl,
        });
      }

      // Show verification message
      res.render('auth/verify-email', {
        user: null,
        email: email,
        currentPage: 'verify-email',
      });
    } catch (unexpectedError) {
      console.error('🚨 UNEXPECTED ERROR IN REGISTRATION:', {
        name: unexpectedError.name,
        message: unexpectedError.message,
        code: unexpectedError.code,
        status: unexpectedError.status,
        stack: unexpectedError.stack,
        fullError: JSON.stringify(unexpectedError, null, 2),
      });
      console.error('🆘 FULL ERROR STACK:');
      console.error(unexpectedError.stack);

      return res.render('auth/register', {
        user: null,
        error: `An unexpected error occurred: ${unexpectedError.message}`,
        currentPage: 'register',
      });
    }
  })
);

/**
 * POST /auth/logout
 * Handle user logout
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    try {
      if (req.token) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      res.clearCookie('sb_access_token');
      res.redirect('/');
    }
  })
);

/**
 * POST /auth/forgot-password
 * Handle password reset request
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Validate input
    if (!email || !isValidEmail(email)) {
      return res.render('auth/forgot-password', {
        user: null,
        error: 'Valid email is required',
        message: null,
        currentPage: 'forgot-password',
      });
    }

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${getSiteUrl()}/auth/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
    }

    // Always show success message to prevent email enumeration
    res.render('auth/reset-sent', {
      user: null,
      email: email,
      currentPage: 'reset-sent',
    });
  })
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Validators moved to utils/validators.js

/**
 * Set authentication cookie
 */
// `setAuthCookie` now provided by `utils/auth.js`

export default router;
