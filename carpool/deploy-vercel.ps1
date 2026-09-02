# Vercel Deployment Script for CarPool Connect (PowerShell)
Write-Host "🚀 Starting Vercel Deployment for CarPool Connect..." -ForegroundColor Green

# Check if Vercel CLI is installed
try {
    $vercelVersion = vercel --version
    Write-Host "✅ Vercel CLI found: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

# Check if user is logged in to Vercel
Write-Host "🔍 Checking Vercel authentication..." -ForegroundColor Yellow
try {
    vercel whoami | Out-Null
    Write-Host "✅ Already logged in to Vercel" -ForegroundColor Green
} catch {
    Write-Host "🔐 Please login to Vercel:" -ForegroundColor Yellow
    vercel login
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Deploy to Vercel
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Green
vercel --prod

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Set up environment variables in Vercel dashboard" -ForegroundColor White
Write-Host "2. Configure custom domain (optional)" -ForegroundColor White
Write-Host "3. Test the deployed application" -ForegroundColor White
Write-Host "4. Set up monitoring and analytics" -ForegroundColor White

Write-Host "🎉 Happy deploying!" -ForegroundColor Green
