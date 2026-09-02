#!/bin/bash

# GitHub Codespaces Setup Script for CarPool Connect
echo "🚀 Setting up CarPool Connect in GitHub Codespaces..."

# Check if we're in Codespaces
if [ -z "$CODESPACE_NAME" ]; then
    echo "⚠️  Warning: Not running in GitHub Codespaces"
    echo "This script is designed for Codespaces environments"
fi

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Setup environment file
if [ ! -f .env ]; then
    echo "🔧 Setting up environment file..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please update .env with your Supabase credentials"
else
    echo "✅ .env file already exists"
fi

# Install global tools
echo "🛠️  Installing global development tools..."
npm install -g vercel
npm install -g nodemon

# Setup Git configuration
echo "🔧 Setting up Git configuration..."
git config --global user.name "GitHub Codespaces User"
git config --global user.email "codespaces@github.com"

# Create helpful aliases
echo "🔧 Creating helpful aliases..."
echo 'alias start="npm run dev"' >> ~/.bashrc
echo 'alias deploy="vercel --prod"' >> ~/.bashrc
echo 'alias test="npm test"' >> ~/.bashrc

# Display setup completion
echo "✅ Codespaces setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with your Supabase credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Access the app via the forwarded port (usually 3000)"
echo "4. Use 'vercel --prod' to deploy to production"
echo ""
echo "🎉 Happy coding in the cloud!"
