-- +goose Up
CREATE TABLE assets_next (
    id INTEGER PRIMARY KEY,
    asset_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','repair','loaned','archived')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO assets_next SELECT * FROM assets;
DROP TABLE assets;
ALTER TABLE assets_next RENAME TO assets;
CREATE TABLE loan_requests (
    id INTEGER PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','cancelled','approved','rejected')),
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX one_pending_request_per_employee ON loan_requests(asset_id,user_id) WHERE status='pending';

-- +goose Down
DROP TABLE loan_requests;
