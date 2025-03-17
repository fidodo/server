
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Create thoughts table
CREATE TABLE IF NOT EXISTS thoughts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  section VARCHAR(50) NOT NULL,
  folder INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create thought_updates table for tracking changes
CREATE TABLE IF NOT EXISTS thought_updates (
  id SERIAL PRIMARY KEY,
  thought_id INTEGER NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS thoughts_user_id_idx ON thoughts(user_id);
CREATE INDEX IF NOT EXISTS thoughts_folder_idx ON thoughts(folder);
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON folders(user_id);
