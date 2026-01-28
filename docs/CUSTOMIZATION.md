# Customization Guide: Floors and Departments (v2.4.0+)

This guide explains how to customize floors and departments for your organization without modifying code.

## Overview

The KNII Ticketing System is fully dynamic - all floors and departments are defined in JSON configuration files. This allows admins to customize the system for any organization before seeding the database.

**Key Benefits**:
- ✅ No code changes needed
- ✅ Validate configuration before database changes
- ✅ Customize for any organization type
- ✅ Protected system department (Internal)
- ✅ Idempotent seeding (safe to run multiple times)

## Configuration Files

### Location
```
config/seed-data/
├── floors.json              # Your building's floors
├── departments.json         # Your organization's departments
├── floors.example.json      # Example template for reference
└── departments.example.json # Example template for reference
```

### Getting Started

1. **Copy example templates**:
   ```bash
   cp config/seed-data/floors.example.json config/seed-data/floors.json
   cp config/seed-data/departments.example.json config/seed-data/departments.json
   ```

2. **Edit configuration files** for your organization

3. **Run seeder**:
   ```bash
   npm run seed:hospital
   ```

4. **Verify** floors and departments are created in the admin UI

---

## Floors Configuration

### File: `config/seed-data/floors.json`

Defines the physical floors/levels in your building.

### Structure

```json
{
  "version": "1.0.0",
  "description": "Floor configuration for your organization",
  "floors": [
    {
      "name": "Basement",
      "sort_order": 0,
      "active": true
    },
    {
      "name": "Ground Floor",
      "sort_order": 1,
      "active": true
    }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | string | Yes | Semantic version (e.g., "1.0.0") for schema evolution |
| description | string | No | Human-readable description of this configuration |
| floors | array | Yes | Array of floor objects (must have at least 1) |
| floors[].name | string | Yes | Floor name (2-50 characters) - must be unique |
| floors[].sort_order | integer | Yes | Display order (0, 1, 2, ...) - must be unique and >= 0 |
| floors[].active | boolean | No | Whether floor is currently in use (default: true) |

### Validation Rules

- **name**:
  - Length: 2-50 characters
  - Unique: No duplicate floor names
  - Required: Cannot be empty
  - Type: Must be a string

- **sort_order**:
  - Type: Integer (whole number)
  - Range: >= 0
  - Unique: No duplicate sort_order values
  - Required: Cannot be null/undefined
  - Purpose: Determines display order in UI

- **active**:
  - Type: Boolean (true/false)
  - Default: true (if omitted)
  - Optional: Can be omitted

### Examples

**Hospital Building** (8 floors):
```json
{
  "version": "1.0.0",
  "floors": [
    {"name": "Basement", "sort_order": 0, "active": true},
    {"name": "Ground Floor", "sort_order": 1, "active": true},
    {"name": "1st Floor", "sort_order": 2, "active": true},
    {"name": "2nd Floor", "sort_order": 3, "active": true},
    {"name": "3rd Floor", "sort_order": 4, "active": true},
    {"name": "4th Floor", "sort_order": 5, "active": true},
    {"name": "5th Floor", "sort_order": 6, "active": true},
    {"name": "6th Floor", "sort_order": 7, "active": true}
  ]
}
```

**Office Building** (4 floors):
```json
{
  "version": "1.0.0",
  "floors": [
    {"name": "Level 1", "sort_order": 1, "active": true},
    {"name": "Level 2", "sort_order": 2, "active": true},
    {"name": "Level 3", "sort_order": 3, "active": true},
    {"name": "Level 4", "sort_order": 4, "active": true}
  ]
}
```

**Single Floor** (1 floor):
```json
{
  "version": "1.0.0",
  "floors": [
    {"name": "Main", "sort_order": 0, "active": true}
  ]
}
```

---

## Departments Configuration

### File: `config/seed-data/departments.json`

Defines departments and assigns them to floors and staff.

### Structure

```json
{
  "version": "1.0.0",
  "super_admin": {
    "username": "admin",
    "email": "admin@organization.local",
    "password": "securepassword",
    "full_name": "Administrator"
  },
  "departments": [
    {
      "name": "Department Name",
      "description": "Brief description",
      "floor": "Ground Floor",
      "user": {
        "username": "dept.username",
        "email": "user@organization.local",
        "password": "password123",
        "full_name": "User Full Name"
      }
    },
    {
      "name": "Internal",
      "description": "Admin-only department",
      "floor": "Ground Floor",
      "user": null
    }
  ]
}
```

### Field Reference

#### Super Admin Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Admin username (3-50 alphanumeric, dots, underscores, hyphens) |
| email | string | Yes | Admin email address |
| password | string | Yes | Admin password (min 6 characters) |
| full_name | string | Yes | Admin full name (2-100 characters) |

#### Department Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Department name (2-100 characters, unique) |
| description | string | No | Brief description of department |
| floor | string | Yes | Floor name (must exist in floors.json) |
| user | object/null | Yes | Department user or null for system departments |

#### Department User Object (if not null)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Username (3-50 alphanumeric, dots, underscores, hyphens) |
| email | string | Yes | Email address (unique across system) |
| password | string | Yes | Password (min 6 characters) |
| full_name | string | Yes | Full name (2-100 characters) |

### Validation Rules

**Department Name**:
- Length: 2-100 characters
- Unique: No duplicate names
- Required: Cannot be empty
- Type: Must be a string

**Floor Reference**:
- Must exist in floors.json
- Case-sensitive match
- Required: Cannot be null/empty
- Type: Must be a string

**User Requirements**:
- **Required departments**: Must have a user object (except Internal)
- **Internal only**: Can have null user
- **Cannot create multiple Internals**: Only one "Internal" department allowed

**Username Validation**:
- Length: 3-50 characters
- Format: Alphanumeric, dots (.), underscores (_), hyphens (-)
- Unique: No duplicate usernames
- Examples: `john.doe`, `jane_smith`, `user-123`

**Email Validation**:
- Format: Must contain @ and domain
- Unique: No duplicate emails
- Length: Max 100 characters
- Examples: `john@organization.local`, `jane@company.com`

**Password Validation**:
- Length: Minimum 6 characters (longer recommended for production)
- Type: Must be a string
- Note: Stored securely (hashed with bcrypt)

### Examples

**Hospital Organization** (10 departments):
```json
{
  "version": "1.0.0",
  "super_admin": {
    "username": "admin",
    "email": "admin@hospital.local",
    "password": "securepass123",
    "full_name": "Administrator"
  },
  "departments": [
    {
      "name": "Emergency Department",
      "description": "Emergency and urgent care services",
      "floor": "Ground Floor",
      "user": {
        "username": "ed.coordinator",
        "email": "ed.coordinator@hospital.local",
        "password": "password123",
        "full_name": "Dr. Sarah Martinez"
      }
    },
    {
      "name": "Cardiology",
      "description": "Cardiovascular services",
      "floor": "2nd Floor",
      "user": {
        "username": "cardiology.lead",
        "email": "cardiology@hospital.local",
        "password": "password123",
        "full_name": "Dr. James Wilson"
      }
    },
    {
      "name": "Internal",
      "description": "Admin-only internal work",
      "floor": "Ground Floor",
      "user": null
    }
  ]
}
```

**Small Office** (5 departments):
```json
{
  "version": "1.0.0",
  "super_admin": {
    "username": "admin",
    "email": "admin@company.local",
    "password": "companypass123",
    "full_name": "Office Administrator"
  },
  "departments": [
    {
      "name": "Human Resources",
      "description": "HR services",
      "floor": "Level 1",
      "user": {
        "username": "hr.manager",
        "email": "hr@company.local",
        "password": "password123",
        "full_name": "Alice Johnson"
      }
    },
    {
      "name": "Finance",
      "description": "Financial operations",
      "floor": "Level 2",
      "user": {
        "username": "finance.lead",
        "email": "finance@company.local",
        "password": "password123",
        "full_name": "Bob Smith"
      }
    },
    {
      "name": "IT Support",
      "description": "Technical support",
      "floor": "Level 1",
      "user": {
        "username": "it.support",
        "email": "it@company.local",
        "password": "password123",
        "full_name": "Charlie Brown"
      }
    },
    {
      "name": "Internal",
      "description": "Admin-only",
      "floor": "Level 1",
      "user": null
    }
  ]
}
```

---

## Validation and Error Messages

### Running the Seeder

```bash
# Load configurations and validate before seeding
npm run seed:hospital
```

### What Happens

1. **Load** JSON config files
2. **Validate** all configurations (50+ validation rules)
3. **Display errors** if any issues found (does NOT modify database)
4. **Seed database** if all validations pass
5. **Log audit trail** of all created records

### Error Examples

**Validation Error - Duplicate Floor**:
```
❌ Configuration validation failed:

  - Floor[2]: Duplicate floor name "Ground Floor"

Please fix the errors above and try again.
```

**Validation Error - Invalid Floor Reference**:
```
❌ Configuration validation failed:

  - Department[3].floor: Floor "10th Floor" does not exist in floors configuration

Please fix the errors above and try again.
```

**Validation Error - Invalid Email**:
```
❌ Configuration validation failed:

  - Department[1].user.email: Invalid email format "invalid-email"

Please fix the errors above and try again.
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Floor does not exist" | Department references floor name not in floors.json | Check floor name spelling (case-sensitive) |
| "Duplicate floor name" | Two floors with same name | Use unique floor names |
| "Invalid email format" | Email missing @ or domain | Use valid email: user@domain.local |
| "Duplicate username" | Two users with same username | Change one username to be unique |
| "Length must be between X and Y" | Field too short or too long | Adjust field to fit constraint |
| "Missing Internal department" | Internal not defined in departments | Add "Internal" department with user: null |
| "Multiple Internal departments" | More than one Internal defined | Keep only one "Internal" department |

---

## Advanced Customization

### Soft Deletion (Inactive Floors)

Mark floors as inactive instead of removing them:

```json
{
  "name": "Old Floor",
  "sort_order": 10,
  "active": false
}
```

**Effect**:
- Floor exists in database but hidden from UI dropdowns
- Department queries exclude inactive floors
- Allows keeping historical data without confusion

### Adding Floors Later

You can add more floors after initial seeding:

1. Edit `config/seed-data/floors.json` to add new floor
2. Run `npm run seed:hospital` again
3. Seeder skips existing floors, adds new ones

### Renaming Departments

To rename a department after seeding:

1. Use **Admin UI** → Departments → Edit
2. Change department name
3. All tickets automatically update (FK CASCADE)
4. Department users' department field updates automatically

### Production Passwords

For production deployments, use secure passwords:

**Do NOT**:
- Hardcode passwords in JSON files
- Use simple passwords like "password123"
- Commit JSON files with production passwords

**Instead**:
- Use environment variables
- Use secret management tools (AWS Secrets Manager, HashiCorp Vault, etc.)
- Load passwords at runtime
- Use complex passwords (16+ characters)

### Custom Floor Naming

Adapt floor names for your organization:

**Hospital**: Basement, Ground Floor, 1st-6th Floor
**Office**: Level 1, Level 2, Level 3
**Factory**: Building A-Floor 1, Building B-Floor 2
**University**: Basement, Ground Floor, Tower 1, Tower 2

Choose names that match your physical layout.

---

## Testing Your Configuration

### 1. Validate Without Seeding

The seeder validates before making any database changes. Simply run:

```bash
npm run seed:hospital
```

If there are errors, fix them and run again. No data is modified until validation passes.

### 2. Test in Development

```bash
# Reset database for clean testing
docker-compose down -v
docker-compose up -d

# Initialize database
npm run seed:hospital

# Verify in admin UI
# Visit http://localhost:3000/admin/floors
# Visit http://localhost:3000/admin/departments
```

### 3. Verify Data

**Check floors**:
```bash
docker-compose exec db psql -U ticketing_user -d ticketing_db \
  -c "SELECT name, sort_order, is_system FROM floors ORDER BY sort_order;"
```

**Check departments**:
```bash
docker-compose exec db psql -U ticketing_user -d ticketing_db \
  -c "SELECT name, floor, is_system FROM departments ORDER BY name;"
```

**Check users**:
```bash
docker-compose exec db psql -U ticketing_user -d ticketing_db \
  -c "SELECT username, email, role, department FROM users;"
```

---

## Troubleshooting

### Issue: Migration Fails on Fresh Install

**Symptom**: Database setup fails during docker-compose up

**Solution**:
1. Reset database: `docker-compose down -v`
2. Rebuild containers: `docker-compose up -d`
3. Check logs: `docker-compose logs db`

### Issue: Seeder Says "Floor Does Not Exist"

**Symptom**: Error when running `npm run seed:hospital`

**Check**:
1. Verify floor names in departments.json match floors.json exactly (case-sensitive)
2. Example: "Ground Floor" ≠ "ground floor" ≠ "GroundFloor"

**Fix**:
```json
// ❌ WRONG - Different capitalization
"floor": "ground floor"

// ✅ CORRECT - Matches floors.json exactly
"floor": "Ground Floor"
```

### Issue: Duplicate Username Error

**Symptom**: "Duplicate username" validation error

**Check**:
1. Each department user must have unique username
2. Super admin username must be unique

**Fix**:
```json
// ❌ WRONG - Same username
{"name": "Dept1", "user": {"username": "user1", ...}},
{"name": "Dept2", "user": {"username": "user1", ...}},

// ✅ CORRECT - Unique usernames
{"name": "Dept1", "user": {"username": "dept1.user", ...}},
{"name": "Dept2", "user": {"username": "dept2.user", ...}},
```

### Issue: Email Validation Fails

**Symptom**: "Invalid email format" error

**Valid Emails**:
- user@organization.local
- john.doe@company.com
- support+team@domain.co.uk

**Invalid Emails**:
- user (no @)
- user@ (no domain)
- user@domain (no TLD)
- user name@domain.com (space in username)

---

## Security Best Practices

### 1. Passwords

- **Minimum**: 6 characters (enforced)
- **Recommended**: 12+ characters for production
- **Never**: Share passwords in version control
- **Consider**: Using environment variables for production passwords

### 2. Configuration Files

- **Version Control**: Only commit examples, not actual configs with real passwords
- **File Permissions**: Restrict access to config/seed-data/ directory
- **Backups**: Keep backups of configs separately from code

### 3. Seeding

- **Test First**: Always test in development before production
- **Review Output**: Check seeder output for unexpected errors
- **Audit Log**: All created records are logged in audit_logs table

### 4. Production Deployment

- Use secret management (AWS Secrets Manager, Vault, etc.)
- Never hardcode passwords in JSON
- Use environment variables for sensitive data
- Rotate passwords regularly

---

## FAQ

**Q: Can I modify floors/departments after seeding?**
A: Yes, use the Admin UI (Floors and Departments sections) to create, edit, and manage them after seeding.

**Q: What happens if I run the seeder twice?**
A: It's safe! The seeder is idempotent - it skips existing floors/departments and creates new ones only.

**Q: Can I delete a floor?**
A: No, if departments reference it. Change departments to different floors first, then delete via Admin UI.

**Q: Can I rename a floor?**
A: Yes, via Admin UI. All department references update automatically (FK CASCADE).

**Q: Is the Internal department special?**
A: Yes, it's marked as `is_system=true` and protected from deletion. It's for admin-only tickets.

**Q: Can I have multiple organizations?**
A: Not by default. This system is single-organization per database.

**Q: Where do custom fields go?**
A: Extend the Department model in `models/Department.js` and add migrations.

---

## Version History

- **v2.4.0** (Jan 2026) - Introduced fully dynamic floors and departments via JSON configuration
- **v2.3.0** - Initial floor management feature
- **v2.2.0** - Department accounts and dual-portal

---

## Support

For issues or questions:
1. Check this guide and error messages
2. Review validator output for specific field errors
3. Verify config file JSON syntax (use JSON validator)
4. Check Floor and Department tables in Admin UI
5. Review database logs: `docker-compose logs db`

