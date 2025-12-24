# KNII Ticketing System

A professional ticket management system built with Node.js, Express, PostgreSQL, and EJS templates. Designed for managing customer support tickets with role-based access control and comprehensive admin features.

## Features

### Public Features
- **Public Ticket Submission**: Customers can submit support tickets without authentication
- **Ticket Status Tracking**: Real-time ticket status updates
- **Email Notifications**: Automated notifications for ticket updates
- **Contact Information**: Easy access to support contact details

### Admin Features
- **Secure Authentication**: Session-based authentication with bcrypt password hashing
- **Role-Based Access Control**: Admin and Super Admin roles with different permissions
- **Ticket Management**: View, update, assign, and manage all support tickets
- **Comment System**: Internal and customer-facing comments on tickets
- **User Management** (Super Admin only):
  - Create, edit, and delete admin users
  - Reset user passwords
  - Enable/disable user accounts
  - Track login attempts and account locking
  - Comprehensive audit logging

### Security Features
- **Account Locking**: Automatic lockout after 5 failed login attempts
- **Password Complexity**: Enforced strong password requirements
- **Session Security**: HTTPOnly cookies with secure session management
- **Audit Logging**: Complete audit trail for all user management actions
- **SQL Injection Protection**: Parameterized queries throughout
- **XSS Protection**: Helmet.js security headers
- **CSRF Protection**: Built-in CSRF token validation

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL 16
- **Template Engine**: EJS
- **Authentication**: express-session with connect-pg-simple
- **Validation**: express-validator
- **Security**: Helmet.js, bcryptjs
- **Containerization**: Docker & Docker Compose

## Project Structure

```
KNII_Ticketing/
├── config/              # Configuration files
│   ├── database.js      # PostgreSQL connection pool
│   └── session.js       # Session configuration
├── constants/           # Application constants
│   ├── enums.js         # Enums (roles, statuses)
│   ├── messages.js      # Flash messages
│   └── validation.js    # Validation messages
├── middleware/          # Express middleware
│   ├── auth.js          # Authentication middleware
│   ├── errorHandler.js  # Error handling
│   └── validation.js    # Request validation
├── migrations/          # Database migrations
│   ├── 001_create_users.sql
│   ├── 002_create_tickets.sql
│   ├── 003_create_comments.sql
│   ├── 004_seed_admin_user.sql
│   ├── 005_enhance_users_table.sql
│   └── 006_create_audit_logs.sql
├── models/              # Database models
│   ├── AuditLog.js
│   ├── Comment.js
│   ├── Ticket.js
│   └── User.js
├── public/              # Static assets
│   ├── css/
│   └── js/
├── routes/              # Express routes
│   ├── admin.js         # Admin dashboard
│   ├── auth.js          # Authentication
│   ├── public.js        # Public routes
│   └── users.js         # User management
├── services/            # Business logic
│   ├── authService.js
│   ├── ticketService.js
│   └── userService.js
├── utils/               # Utility functions
│   ├── passwordValidator.js
│   └── responseHelpers.js
├── validators/          # Request validators
│   ├── authValidators.js
│   ├── commentValidators.js
│   ├── ticketValidators.js
│   └── userValidators.js
├── views/               # EJS templates
│   ├── admin/
│   ├── auth/
│   ├── errors/
│   ├── partials/
│   └── public/
├── .dockerignore
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── index.js             # Application entry point
├── package.json
└── README.md
```

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/KNII_Ticketing.git
   cd KNII_Ticketing
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   ```env
   # Database
   POSTGRES_USER=ticketing_user
   POSTGRES_PASSWORD=your_secure_password
   POSTGRES_DB=ticketing_db
   DATABASE_URL=postgresql://ticketing_user:your_secure_password@db:5432/ticketing_db

   # Session
   SESSION_SECRET=your_secret_key_change_this_in_production

   # Application
   PORT=3000
   NODE_ENV=development
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Public site: http://localhost:3000
   - Admin login: http://localhost:3000/auth/login

### Default Admin Credentials
```
Username: admin
Password: admin123
```

**IMPORTANT**: Change these credentials immediately in production!

## User Management

### Roles

- **Admin**: Can view and manage tickets, add comments
- **Super Admin**: All admin permissions plus user management capabilities

### User Management Features (Super Admin Only)

1. **Create Users**
   - Navigate to User Management → Create New User
   - Set username, email, password, and role
   - Password complexity requirements enforced

2. **Edit Users**
   - Modify user details (username, email, role, status)
   - Change user role (admin ↔ super_admin)
   - Enable/disable user accounts

3. **Delete Users**
   - Soft delete (data preserved for audit)
   - Cannot delete yourself
   - Cannot delete the last super admin

4. **Reset Passwords**
   - Admin-initiated password resets
   - No current password required
   - Logged in audit trail

5. **Account Security**
   - Accounts locked after 5 failed login attempts
   - Contact administrator to unlock
   - Failed attempts tracked per user

## Database Migrations

Migrations run automatically on container startup via Docker entrypoint. To run manually:

```bash
docker-compose exec db psql -U ticketing_user -d ticketing_db -f /docker-entrypoint-initdb.d/001_create_users.sql
```

### Migration Order
1. `001_create_users.sql` - User accounts table
2. `002_create_tickets.sql` - Support tickets table
3. `003_create_comments.sql` - Ticket comments table
4. `004_seed_admin_user.sql` - Default admin user
5. `005_enhance_users_table.sql` - Add user management fields
6. `006_create_audit_logs.sql` - Audit logging table

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d db

# Run migrations
npm run migrate

# Start development server
npm run dev
```

### Environment Modes

- **Development**: Hot reload with nodemon, verbose logging
- **Production**: Optimized performance, secure headers

### Testing

The application has been manually tested with:
- User creation, editing, deletion
- Password reset functionality
- Role-based access control
- Account locking after failed attempts
- Audit logging for all actions
- Session management and timeout

## Security Best Practices

1. **Change Default Credentials**: Immediately update the default admin password
2. **Use Strong Passwords**: Enforce password complexity requirements
3. **Enable HTTPS**: Use reverse proxy (nginx) with SSL in production
4. **Regular Updates**: Keep dependencies updated
5. **Database Backups**: Regular automated backups
6. **Audit Logs**: Monitor audit logs for suspicious activity
7. **Session Secret**: Use strong, random session secret in production

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment instructions.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For issues or questions:
- Create an issue in the GitHub repository
- Contact: support@kniitickets.com

## Changelog

### Version 1.0.0 (2025-12-24)
- Initial release
- Public ticket submission
- Admin dashboard
- User management system
- Role-based access control
- Audit logging
- Account security features

---

Built with ❤️ using Node.js and PostgreSQL
