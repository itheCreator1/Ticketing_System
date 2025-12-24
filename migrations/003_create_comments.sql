CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
