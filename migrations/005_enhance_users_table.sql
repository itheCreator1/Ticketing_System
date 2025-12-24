-- Add new columns to users table for user management
ALTER TABLE users
  ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  ADD COLUMN last_login_at TIMESTAMP,
  ADD COLUMN login_attempts INTEGER DEFAULT 0,
  ADD COLUMN password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN deleted_at TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- Update existing users to have active status
UPDATE users SET status = 'active' WHERE status IS NULL;
