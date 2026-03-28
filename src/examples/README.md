# Protected API Routes Examples

This directory contains comprehensive examples of RBAC-protected API routes for the QT Office Check Printing System. These examples demonstrate how to implement secure, permission-based access control for all major system operations.

## 📁 Files Overview

- **`protected-checks-api.ts`** - Check management operations
- **`protected-vendors-api.ts`** - Vendor management operations  
- **`protected-banks-api.ts`** - Bank account management operations
- **`protected-reports-api.ts`** - Reports and analytics operations
- **`protected-users-api.ts`** - User management operations

## 🔐 Security Features

### JWT Token Verification
All routes automatically verify JWT tokens and extract user information for permission checking.

### Permission-Based Access Control
Each route requires specific permissions:
- **CREATE_CHECK** - Create new checks
- **VOID_CHECK** - Void/cancel checks (MANAGER+ only)
- **MANAGE_VENDORS** - Full vendor management
- **VIEW_REPORTS** - Access reports and analytics
- **EXPORT_REPORTS** - Export reports to CSV/PDF/Excel
- **MANAGE_USERS** - Full user management (ADMIN only)

### Role Hierarchy Enforcement
- **ADMIN** - Full system access
- **MANAGER** - Most operations except user management
- **USER** - Limited to basic check operations

### Comprehensive Logging
All access attempts (authorized and unauthorized) are logged with:
- User information
- IP address
- Timestamp
- Action performed
- Success/failure status

## 🚀 API Routes Examples

### 1. Check Management (`/api/checks`)

#### POST - Create New Check
```typescript
// Requires: CREATE_CHECK permission
// Validates: Bank balance, vendor existence, check number uniqueness
// Security: Automatic bank balance deduction, audit logging

POST /api/checks
{
  "checkNumber": "CHK-001",
  "paymentMethod": "CHECK",
  "bankId": "bank-uuid",
  "vendorId": "vendor-uuid", 
  "amount": 1500.00,
  "memo": "Office supplies",
  "issuedBy": "user-uuid"
}
```

#### DELETE - Void Check
```typescript
// Requires: MANAGER+ role, VOID_CHECK permission
// Security: Prevents voiding cleared checks, restores bank balance

DELETE /api/checks/[id]
```

#### GET - List Checks
```typescript
// Requires: VIEW_CHECK permission
// Features: Pagination, filtering by status/vendor, search

GET /api/checks?page=1&limit=10&status=PENDING&vendorId=vendor-uuid
```

### 2. Vendor Management (`/api/vendors`)

#### POST - Create Vendor
```typescript
// Requires: MANAGE_VENDORS permission
// Validates: Store existence, vendor name uniqueness per store

POST /api/vendors
{
  "vendorName": "ABC Supplies",
  "vendorType": "MERCHANDISE",
  "description": "Office supplies vendor",
  "contact": {
    "email": "contact@abcsupplies.com",
    "phone": "(555) 123-4567",
    "address": "123 Business St, City, State"
  },
  "storeId": "store-uuid"
}
```

#### PUT - Update Vendor
```typescript
// Requires: MANAGE_VENDORS permission
// Security: Prevents name conflicts, validates store assignments

PUT /api/vendors/[id]
```

#### DELETE - Delete Vendor
```typescript
// Requires: MANAGE_VENDORS permission
// Security: Prevents deletion if vendor has associated checks

DELETE /api/vendors/[id]
```

### 3. Bank Management (`/api/banks`)

#### POST - Create Bank Account
```typescript
// Requires: ADMIN role only
// Security: Account numbers encrypted automatically, duplicate prevention

POST /api/banks
{
  "bankName": "Chase Bank",
  "accountNumber": "1234567890",
  "routingNumber": "021000021",
  "storeId": "store-uuid",
  "balance": 10000.00
}
```

#### GET - List Banks
```typescript
// Requires: MANAGER+ role
// Security: Encrypted account numbers returned securely

GET /api/banks?page=1&limit=10&storeId=store-uuid
```

#### PATCH - Update Bank Balance
```typescript
// Requires: ADMIN role only
// Security: Audit trail for balance changes, reason required

PATCH /api/banks/[id]/balance
{
  "balance": 15000.00,
  "reason": "Deposit from customer payment"
}
```

### 4. Reports (`/api/reports`)

#### GET - Generate Reports
```typescript
// Requires: VIEW_REPORTS permission
// Features: Comprehensive filtering, summary statistics, pagination

GET /api/reports?startDate=2024-01-01&endDate=2024-12-31&status=CLEARED&paymentMethod=CHECK
```

#### POST - Export Reports
```typescript
// Requires: EXPORT_REPORTS permission
// Formats: CSV, PDF, Excel
// Security: Full audit trail of exports

POST /api/reports/export
{
  "format": "CSV",
  "filters": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "status": "CLEARED"
  }
}
```

### 5. User Management (`/api/users`)

#### POST - Create User
```typescript
// Requires: ADMIN role only
// Security: Password hashing, username/email uniqueness validation

POST /api/users
{
  "username": "john.doe",
  "email": "john@company.com",
  "password": "SecurePassword123!",
  "role": "MANAGER",
  "storeId": "store-uuid"
}
```

#### PUT - Update User
```typescript
// Requires: ADMIN role only
// Security: Prevents conflicts, validates role assignments

PUT /api/users/[id]
```

#### PATCH - Change Password
```typescript
// Requires: ADMIN role only
// Security: Current password verification, strong password requirements

PATCH /api/users/[id]/password
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!",
  "confirmPassword": "NewPassword456!"
}
```

## 🛡️ Error Handling

### Standard Error Responses

#### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "Please provide a valid JWT token"
}
```

#### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "message": "You don't have permission to perform this action"
}
```

#### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be positive"
    }
  ]
}
```

#### 404 Not Found
```json
{
  "error": "Resource not found",
  "message": "The requested resource does not exist"
}
```

## 🔧 Implementation Guide

### 1. Copy Route Files
Copy the example files to your actual API routes:
```bash
cp src/examples/protected-checks-api.ts src/app/api/checks/route.ts
cp src/examples/protected-vendors-api.ts src/app/api/vendors/route.ts
# ... etc
```

### 2. Update Database Schema
Ensure your Prisma schema matches the expected models:
```prisma
model User {
  id        String @id @default(cuid())
  username  String @unique
  email     String @unique
  password  String
  role      Role
  storeId   String
  store     Store  @relation(fields: [storeId], references: [id])
  // ... other fields
}

enum Role {
  ADMIN
  MANAGER
  USER
}
```

### 3. Environment Variables
Ensure these environment variables are set:
```env
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
DATABASE_URL=your-database-url
```

### 4. Middleware Configuration
The RBAC middleware automatically:
- Verifies JWT tokens
- Extracts user information
- Checks permissions
- Logs access attempts
- Returns appropriate error responses

## 📊 Monitoring and Logging

### Access Logs
All API access is logged with:
```typescript
console.log(`Check ${checkNumber} created successfully by user ${userId}`);
console.warn(`Unauthorized access attempt from IP: ${req.ip}`);
```

### Audit Trail
Critical operations create audit entries:
- User creation/deletion
- Password changes
- Bank balance updates
- Check voiding
- Report exports

### Security Monitoring
Monitor for:
- Failed authentication attempts
- Permission violations
- Unusual access patterns
- Multiple failed requests from same IP

## 🚨 Security Best Practices

### 1. Input Validation
- All inputs validated with Zod schemas
- SQL injection prevention via Prisma
- XSS protection through proper escaping

### 2. Authentication
- JWT tokens with expiration
- Secure password hashing (bcrypt)
- Session management

### 3. Authorization
- Role-based access control
- Permission-based operations
- Principle of least privilege

### 4. Data Protection
- Sensitive data encryption (AES-256)
- Secure database connections
- Environment variable protection

### 5. Audit and Monitoring
- Comprehensive logging
- Access attempt tracking
- Security event monitoring

## 🧪 Testing

### Unit Tests
Test individual functions:
```typescript
describe('Check Creation', () => {
  it('should create check with valid permissions', async () => {
    // Test implementation
  });
  
  it('should reject unauthorized access', async () => {
    // Test implementation
  });
});
```

### Integration Tests
Test complete API workflows:
```typescript
describe('Check Management Workflow', () => {
  it('should create, view, and void check', async () => {
    // Test complete workflow
  });
});
```

### Security Tests
Test security measures:
```typescript
describe('Security Tests', () => {
  it('should prevent unauthorized access', async () => {
    // Test security
  });
  
  it('should validate input properly', async () => {
    // Test validation
  });
});
```

## 📈 Performance Considerations

### Database Optimization
- Proper indexing on frequently queried fields
- Pagination for large datasets
- Efficient query patterns

### Caching
- Cache frequently accessed data
- Implement Redis for session storage
- Cache permission checks

### Rate Limiting
- Implement rate limiting for API endpoints
- Prevent brute force attacks
- Monitor API usage patterns

## 🔄 Maintenance

### Regular Updates
- Update dependencies regularly
- Review and update permissions
- Monitor security advisories

### Backup and Recovery
- Regular database backups
- Test recovery procedures
- Document recovery processes

### Monitoring
- Set up alerts for security events
- Monitor system performance
- Track user activity patterns

---

These protected API routes provide a solid foundation for building secure, scalable applications with comprehensive access control and audit capabilities.



