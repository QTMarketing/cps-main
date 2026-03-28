#!/bin/bash

# Setup script for CPS Database

echo "Setting up CPS Database..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/cps_database?schema=public"

# Next.js
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
EOF
fi

echo "Environment file created/updated."

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure PostgreSQL is running on localhost:5432"
echo "2. Create a database named 'cps_database'"
echo "3. Run: npm run db:push (to push schema to database)"
echo "4. Or run: npm run db:migrate (for migrations)"
echo ""
echo "To start the development server: npm run dev"
echo "To open Prisma Studio: npm run db:studio"





