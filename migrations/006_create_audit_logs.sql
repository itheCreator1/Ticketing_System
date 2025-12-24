-- Create audit logs table for tracking user management actions
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for common queries
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
