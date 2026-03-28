# Check Printing System (CPS)

A comprehensive check printing and payment management system built with Next.js 14, TypeScript, Tailwind CSS, and Prisma with PostgreSQL.

## Features

- **User Management**: Multi-role user system (admin, manager, user)
- **Store Management**: Multi-store support
- **Bank Management**: Multiple bank accounts per store
- **Vendor Management**: Vendor information and categorization
- **Check Processing**: Complete check lifecycle management
- **Audit Logging**: Comprehensive activity tracking
- **Dark Theme**: Modern, professional interface

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **UI Components**: Custom components with Tailwind CSS

## Database Models

### User
- `id`: Unique identifier
- `username`: Unique username
- `email`: Unique email address
- `password`: Hashed password
- `role`: User role (admin, manager, user)
- `storeId`: Associated store

### Store
- `id`: Unique identifier
- `name`: Store name
- `address`: Store address
- `phone`: Contact phone number

### Bank
- `id`: Unique identifier
- `bankName`: Bank name
- `accountNumber`: Account number
- `routingNumber`: Routing number
- `storeId`: Associated store
- `balance`: Current balance

### Vendor
- `id`: Unique identifier
- `vendorName`: Vendor name
- `vendorType`: Type (Merchandise, Expense, Employee)
- `description`: Optional description
- `contact`: Contact information
- `storeId`: Associated store

### Check
- `id`: Unique identifier
- `checkNumber`: Unique check number
- `paymentMethod`: Payment method (Check, EDI, MO, Cash)
- `bankId`: Associated bank
- `vendorId`: Associated vendor
- `amount`: Check amount
- `memo`: Optional memo
- `status`: Status (Draft, Submitted, Approved, Printed, Reconciled)
- `issuedBy`: User who issued the check

### AuditLog
- `id`: Unique identifier
- `userId`: User who performed the action
- `action`: Action type (CREATE, UPDATE, DELETE, VIEW)
- `entityType`: Entity type (User, Store, Bank, Vendor, Check)
- `entityId`: ID of the affected entity
- `timestamp`: When the action occurred

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user by ID
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user

### Stores
- `GET /api/stores` - Get all stores
- `POST /api/stores` - Create store
- `GET /api/stores/[id]` - Get store by ID
- `PUT /api/stores/[id]` - Update store
- `DELETE /api/stores/[id]` - Delete store

### Banks
- `GET /api/banks` - Get all banks
- `POST /api/banks` - Create bank
- `GET /api/banks/[id]` - Get bank by ID
- `PUT /api/banks/[id]` - Update bank
- `DELETE /api/banks/[id]` - Delete bank

### Vendors
- `GET /api/vendors` - Get all vendors
- `POST /api/vendors` - Create vendor
- `GET /api/vendors/[id]` - Get vendor by ID
- `PUT /api/vendors/[id]` - Update vendor
- `DELETE /api/vendors/[id]` - Delete vendor

### Checks
- `GET /api/checks` - Get all checks
- `POST /api/checks` - Create check
- `GET /api/checks/[id]` - Get check by ID
- `PUT /api/checks/[id]` - Update check
- `DELETE /api/checks/[id]` - Delete check

### Audit Logs
- `GET /api/audit-logs` - Get all audit logs
- `POST /api/audit-logs` - Create audit log

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your database credentials:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/cps_database?schema=public"
   ```

3. **Set up the database**
   ```bash
   # Create the database (if it doesn't exist)
   createdb cps_database
   
   # Push the schema to the database
   npm run db:push
   
   # Or use migrations
   npm run db:migrate
   ```

4. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

### Database Setup Script

You can also use the provided setup script:

```bash
./setup-db.sh
```

This will:
- Create the `.env` file
- Generate the Prisma client
- Provide next steps for database setup

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## Database Management

### Prisma Studio
To view and manage your database through a web interface:
```bash
npm run db:studio
```

### Migrations
To create and apply database migrations:
```bash
npm run db:migrate
```

### Schema Push
To push schema changes directly to the database:
```bash
npm run db:push
```

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── users/          # User CRUD operations
│   │   ├── stores/         # Store CRUD operations
│   │   ├── banks/          # Bank CRUD operations
│   │   ├── vendors/        # Vendor CRUD operations
│   │   ├── checks/         # Check CRUD operations
│   │   └── audit-logs/     # Audit log operations
│   ├── layout.tsx          # Root layout
│   ├── page.tsx           # Dashboard
│   └── [pages]/           # Application pages
├── components/
│   └── ui/                # UI components
├── lib/
│   ├── prisma.ts          # Prisma client
│   └── audit.ts           # Audit logging utilities
└── prisma/
    └── schema.prisma      # Database schema
```

## Usage

1. **Access the application**: http://localhost:3000
2. **Navigate using the sidebar**:
   - Write Checks
   - Reports
   - Add Vendor
   - Add User
   - Add Bank

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.