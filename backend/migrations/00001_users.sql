-- +goose Up
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    google_subject TEXT UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('employee', 'admin')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX one_administrator ON users(role) WHERE role = 'admin';

-- +goose Down
DROP TABLE users;
