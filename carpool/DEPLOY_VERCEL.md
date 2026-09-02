# Vercel Deployment Guide - CarPool Connect

This guide provides step-by-step instructions to deploy the CarPool Connect application on Vercel platform.

## 🚀 Prerequisites

Before deploying to Vercel, ensure you have:

- **Vercel Account**: Free account at [vercel.com](https://vercel.com)
- **GitHub Account**: For code hosting and Vercel integration
- **Supabase Project**: Database and authentication backend
- **Node.js**: Local development environment (optional)

## 📋 Deployment Overview

CarPool Connect is a **full-stack application** that requires special configuration for Vercel deployment:

- **Frontend**: Static assets (HTML, CSS, JS) - ✅ Vercel Native
- **Backend**: Node.js API routes - ✅ Vercel Serverless Functions
- **Database**: Supabase (external) - ✅ Works with Vercel
- **Authentication**: Supabase Auth - ✅ Works with Vercel

## 🛠️ Step 1: Prepare Your Project

### 1.1 Update Project Structure for Vercel

Create a `vercel.json` configuration file:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "server.js": {
      "maxDuration": 30
    }
  }
}
```

### 1.2 Update Server.js for Vercel

Modify your `server.js` to work with Vercel:

```javascript
// Add this at the end of server.js
// Vercel serverless export
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

### 1.3 Create Vercel-Specific API Routes

Create `api/index.js` for Vercel serverless functions:

```javascript
import app from '../server.js';

export default app;
```

## 🔧 Step 2: Environment Variables Configuration

### 2.1 Required Environment Variables

Set these in your Vercel dashboard:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenRouteService API (for maps)
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key

# Session Configuration
SESSION_SECRET=your_secure_session_secret

# Server Configuration
NODE_ENV=production
PORT=3000
```

### 2.2 How to Set Environment Variables in Vercel

1. **Via Vercel Dashboard**:
   - Go to your project dashboard
   - Click "Settings" → "Environment Variables"
   - Add each variable with its value

2. **Via Vercel CLI**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add OPENROUTESERVICE_API_KEY
   vercel env add SESSION_SECRET
   ```

## 📦 Step 3: Package.json Configuration

### 3.1 Update Scripts

Ensure your `package.json` has the correct scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "build": "echo 'No build step required'",
    "dev": "nodemon server.js"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### 3.2 Add Vercel Dependencies

```bash
npm install --save-dev @vercel/node
```

## 🚀 Step 4: Deploy to Vercel

### 4.1 Method 1: Via Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy Project**:
   ```bash
   vercel --prod
   ```

4. **Follow Prompts**:
   - Set up and link to your Vercel account
   - Choose project settings
   - Confirm environment variables

### 4.2 Method 2: Via GitHub Integration

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure project settings

3. **Configure Deployment**:
   - Framework Preset: "Other"
   - Root Directory: "./"
   - Build Command: Leave empty
   - Output Directory: "public"
   - Install Command: "npm install"

## ⚙️ Step 5: Vercel Configuration

### 5.1 Project Settings

In your Vercel dashboard, configure:

- **Framework Settings**:
  - Framework: Other
  - Root Directory: ./
  - Build Command: (leave empty)
  - Output Directory: public
  - Install Command: npm install

- **Environment Variables**:
  - Add all required environment variables from Step 2

### 5.2 Domain Configuration

1. **Default Domain**: Vercel provides a `.vercel.app` domain
2. **Custom Domain**: Add your custom domain in project settings
3. **SSL Certificate**: Automatically provided by Vercel

## 🔍 Step 6: Verify Deployment

### 6.1 Check Functionality

Test these features after deployment:

1. **Home Page**: `https://your-app.vercel.app/`
2. **Trip Listing**: `https://your-app.vercel.app/trips`
3. **Authentication**: Login/register functionality
4. **API Endpoints**: Test API calls work correctly
5. **Database**: Verify Supabase connections

### 6.2 Debug Common Issues

#### **API Routes Not Working**:
```bash
# Check vercel.json configuration
# Ensure server.js exports the app
# Verify environment variables are set
```

#### **Database Connection Issues**:
```bash
# Verify Supabase URL and keys
# Check RLS policies in Supabase
# Test database connectivity
```

#### **Static Assets Not Loading**:
```bash
# Check public directory structure
# Verify CSS/JS file paths
# Ensure build output is correct
```

## 🛡️ Step 7: Security Considerations

### 7.1 Environment Variables Security

- **Never commit** `.env` files to Git
- **Use Vercel's encrypted** environment variables
- **Rotate secrets** regularly
- **Use different keys** for development and production

### 7.2 CORS Configuration

Update your server to handle CORS for Vercel:

```javascript
// In server.js middleware setup
import cors from 'cors';

app.use(cors({
  origin: ['https://your-app.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
```

### 7.3 Rate Limiting

Add rate limiting for API endpoints:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## 📊 Step 8: Performance Optimization

### 8.1 Caching Strategy

```javascript
// Add caching headers for static assets
app.use(express.static('public', {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));
```

### 8.2 Image Optimization

- Use WebP format for images
- Implement lazy loading
- Optimize image sizes

### 8.3 Bundle Optimization

```javascript
// In package.json
{
  "scripts": {
    "build": "npm run optimize:images && npm run minify:css"
  }
}
```

## 🔧 Step 9: Monitoring and Analytics

### 9.1 Vercel Analytics

Enable in Vercel dashboard:
- Go to "Analytics" tab
- Enable real-time analytics
- Monitor performance metrics

### 9.2 Error Tracking

Add error tracking:

```javascript
// In server.js
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Log to Vercel analytics
  if (process.env.NODE_ENV === 'production') {
    // Send to error tracking service
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});
```

## 🔄 Step 10: Continuous Deployment

### 10.1 Automatic Deployments

Set up automatic deployments from GitHub:

1. **Connect Repository**: Link your GitHub repo
2. **Branch Configuration**: Deploy `main` branch automatically
3. **Preview Deployments**: Enable for pull requests
4. **Custom Domains**: Configure production domains

### 10.2 Deployment Hooks

Add deployment hooks in `vercel.json`:

```json
{
  "functions": {
    "server.js": {
      "maxDuration": 30
    }
  },
  "build": {
    "env": {
      "CUSTOM_BUILD_STEP": "true"
    }
  }
}
```

## 🚨 Troubleshooting Guide

### Common Issues and Solutions

#### **1. Serverless Function Timeout**
```bash
# Error: Function execution timed out
# Solution: Increase maxDuration in vercel.json
```

#### **2. Environment Variables Not Loading**
```bash
# Error: undefined environment variables
# Solution: Check Vercel dashboard settings
# Verify variable names match exactly
```

#### **3. Database Connection Failed**
```bash
# Error: Supabase connection failed
# Solution: Verify Supabase URL and keys
# Check RLS policies
# Test connection locally first
```

#### **4. Static Assets 404**
```bash
# Error: CSS/JS files not found
# Solution: Check public directory structure
# Verify file paths in HTML
# Ensure build output includes assets
```

#### **5. API Routes Not Working**
```bash
# Error: API endpoints return 404
# Solution: Check vercel.json routes
# Verify server.js exports app
# Test locally first
```

## 📋 Deployment Checklist

### Pre-Deployment Checklist:
- [ ] All environment variables set in Vercel
- [ ] Database connections tested locally
- [ ] API endpoints working locally
- [ ] Static assets optimized
- [ ] Error handling implemented
- [ ] CORS configured properly
- [ ] Rate limiting added
- [ ] Security measures in place

### Post-Deployment Checklist:
- [ ] Home page loads correctly
- [ ] Authentication works
- [ ] Trip listing functions
- [ ] Map features work
- [ ] Booking system operational
- [ ] Mobile responsive design
- [ ] Performance metrics acceptable
- [ ] Error monitoring active

## 🎉 Success Metrics

Your deployment is successful when:

- ✅ **Home Page**: Loads without errors
- ✅ **Authentication**: Users can register/login
- ✅ **Trip Management**: CRUD operations work
- ✅ **Maps**: Interactive maps display correctly
- ✅ **Booking**: Seat booking functions properly
- ✅ **Performance**: Load time < 3 seconds
- ✅ **Mobile**: Responsive on all devices
- ✅ **Security**: No exposed secrets
- ✅ **Monitoring**: Error tracking active

## 📞 Support and Resources

### Vercel Documentation:
- [Vercel Docs](https://vercel.com/docs)
- [Serverless Functions](https://vercel.com/docs/concepts/functions)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

### Common Issues:
- [Vercel Troubleshooting](https://vercel.com/docs/concepts/troubleshooting)
- [Serverless Function Limits](https://vercel.com/docs/concepts/functions/serverless-functions/limits)

### Community Support:
- [Vercel Discord](https://vercel.com/discord)
- [GitHub Issues](https://github.com/vercel/vercel/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/vercel)

---

## 🚀 Ready to Deploy!

Your CarPool Connect application is now ready for Vercel deployment. Follow these steps in order:

1. **Configure vercel.json**
2. **Update server.js for Vercel**
3. **Set environment variables**
4. **Deploy via CLI or GitHub**
5. **Test all functionality**
6. **Monitor performance**

**Happy deploying! 🎉**

---

*This guide covers the complete deployment process for CarPool Connect on Vercel. For additional support, refer to the Vercel documentation or community forums.*
