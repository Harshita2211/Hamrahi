import supabase from './supabase.js';

/**
 * Authentication helpers: token parsing, cookie helpers, and middleware
 */

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const getTokenFromRequest = (req) => {
  const header = req.headers?.authorization;
  const bearer = header && header.split && header.split(' ')[1];
  return req.cookies?.sb_access_token || bearer || null;
};

function setAuthCookie(res, accessToken) {
  res.cookie('sb_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
  });
}

const requireAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.redirect('/auth/login');
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.clearCookie('sb_access_token');
      return res.redirect('/auth/login');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.clearCookie('sb_access_token');
    res.redirect('/auth/login');
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (token) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (err) {
    console.error('Optional auth error:', err);
    next();
  }
};

export { getTokenFromRequest, setAuthCookie, requireAuth, optionalAuth };
