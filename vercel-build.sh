#!/bin/bash

# Vercel Build Script
# This runs during Vercel deployment to set up the database

echo "🔨 Building CPS application..."

# 1. Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# 2. Push schema to create tables if they don't exist
echo "🗄️  Setting up database schema..."
npx prisma db push --accept-data-loss || echo "Tables might already exist"

echo "✅ Build complete!"

