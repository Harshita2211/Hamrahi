/**
 * Profile Routes
 * Clean, organized route handlers for user profile management
 */

import express from 'express';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateProfileUpdate, validatePasswordChange } from '../utils/validators.js';
import supabase from '../utils/supabase.js';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for Supabase upload
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

/**
 * Upload avatar to Supabase storage
 * @param {Object} req - Express request object
 * @returns {Promise} - Upload result with publicUrl or error
 */
async function uploadAvatarToSupabase(req) {
  const file = req.file;

  if (!file) {
    return {
      error: null,
      publicUrl: null,
    };
  }

  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    return {
      error: 'Avatar file size must be less than 5MB',
      publicUrl: null,
    };
  }

  const fileExt = path.extname(file.originalname);
  const fileName = `avatar-${req.user.id}-${Date.now()}${fileExt}`;
  const filePath = `${req.user.id}/${fileName}`;

  try {
    // Upload to Supabase storage
    const { data, error: uploadError } = await supabase.storage
      .from('avatar')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
        cacheControl: '3600', // Cache for 1 hour
      });

    if (uploadError) {
      return {
        error: 'Failed to upload avatar: ' + uploadError.message,
        publicUrl: null,
      };
    }

    // Get signed URL (more reliable than public URL)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('avatar')
      .createSignedUrl(filePath, 31536000); // 1 year expiry

    if (signedUrlError || !signedUrlData || !signedUrlData.signedUrl) {
      console.error('Signed URL error:', signedUrlError);
      return {
        error: 'Failed to get avatar URL. Please try again.',
        publicUrl: null,
      };
    }

    return {
      error: null,
      publicUrl: signedUrlData.signedUrl,
    };
  } catch (error) {
    return {
      error: 'Avatar upload failed: ' + error.message,
      publicUrl: null,
    };
  }
}

/**
 * Clean up old avatar from Supabase storage
 * @param {string} currentAvatarUrl - Current avatar URL
 * @param {string} userId - User ID
 */
async function cleanupOldAvatar(currentAvatarUrl, userId) {
  if (!currentAvatarUrl) {
    return; // No old avatar to clean
  }

  try {
    const oldUrl = new URL(currentAvatarUrl);
    const oldPath = oldUrl.pathname.substring(1); // Remove leading slash

    await supabase.storage.from('avatar').remove([oldPath], {
      cascade: true,
    });

    console.log(' Old avatar cleaned up:', oldPath);
  } catch (cleanupError) {
    console.warn('Failed to clean up old avatar:', cleanupError);
  }
}

// Profile page - Auth required
// Profile page - Auth required
router.get('/', requireAuth, async (req, res) => {
  try {
    // 1. Try to fetch the profile
    let { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    // 2. If no profile exists (PGRST116 is Supabase's "no rows found" error)
    // Create one automatically so the user doesn't see an error page
    if (error && error.code === 'PGRST116') {
      console.log('No profile found, creating a new one for user:', req.user.id);
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{ 
            id: req.user.id, 
            full_name: req.user.email.split('@')[0], // Use email prefix as a default name
            avatar_url: null 
        }])
        .select()
        .single();

      if (createError) throw createError;
      profile = newProfile;
      error = null;
    }

    // 3. Render the page with the found (or newly created) profile
    res.render('profile/index', {
      user: req.user,
      profile: profile || {},
      error: error ? 'Failed to load profile' : null,
      message: null,
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.render('profile/index', {
      user: req.user,
      profile: null,
      error: 'An unexpected error occurred while loading your profile.',
    });
  }
});

// Update profile - Auth required
router.post('/update', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { full_name, phone, bio } = req.body;

    // Validation
    const validationErrors = validateProfileUpdate({ full_name, phone });
    if (validationErrors.length > 0) {
      return res.render('profile/index', {
        user: req.user,
        profile: req.body,
        error: validationErrors.join(', '),
        message: null,
      });
    }

    const updateData = {
      full_name: full_name.trim(),
      phone: phone.trim(),
      bio: bio ? bio.trim() : null,
    };

    // Handle avatar upload
    if (req.file) {
      try {
        // Get current profile to clean up old avatar
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', req.user.id)
          .single();

        const uploadResult = await uploadAvatarToSupabase(req);

        if (uploadResult.error) {
          console.error('Avatar upload error:', uploadResult.error);
          return res.render('profile/index', {
            user: req.user,
            profile: req.body,
            error: uploadResult.error,
            message: null,
          });
        }

        // Update profile with new avatar URL
        updateData.avatar_url = uploadResult.publicUrl;

        // Clean up old avatar after successful upload
        if (currentProfile?.avatar_url) {
          await cleanupOldAvatar(currentProfile.avatar_url, req.user.id);
        }
      } catch (uploadErr) {
        console.error('Avatar upload error:', uploadErr);
        return res.render('profile/index', {
          user: req.user,
          profile: req.body,
          error: 'Avatar upload failed: ' + uploadErr.message,
          message: null,
        });
      }
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    res.render('profile/index', {
      user: req.user,
      profile: updatedProfile,
      error: null,
      message: 'Profile updated successfully!',
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.render('profile/index', {
      user: req.user,
      profile: req.body,
      error: error.message || 'Failed to update profile',
      message: null,
    });
  }
});

// Change password - Auth required
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password, password_confirm } = req.body;

    // Validation
    const passwordErrors = validatePasswordChange({
      current_password,
      new_password,
      password_confirm,
    });
    if (passwordErrors.length > 0) {
      return res.render('profile/index', {
        user: req.user,
        profile: {},
        error: passwordErrors.join(', '),
        message: null,
      });
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
      password: new_password,
    });

    if (error) {
      console.error('Password change error:', error);
      throw error;
    }

    // Fetch current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    res.render('profile/index', {
      user: req.user,
      profile: profile || {},
      error: null,
      message: 'Password changed successfully!',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.render('profile/index', {
      user: req.user,
      profile: {},
      error: error.message || 'Failed to change password',
      message: null,
    });
  }
});

export default router;
