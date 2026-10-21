-- +goose Up
CREATE TABLE assets (
    id INTEGER PRIMARY KEY,
    asset_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'repair')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
DROP TABLE assets;
