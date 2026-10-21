package database

import (
	"context"
	"path/filepath"
	"testing"
)

func TestMigrationAndPersistence(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "data", "app.sqlite")
	connection, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := connection.ExecContext(ctx, "INSERT INTO users(email, role) VALUES (?, ?)", "example@example.invalid", "employee"); err != nil {
		t.Fatal(err)
	}
	connection.Close()
	connection, err = Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	var count int
	if err := connection.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count); err != nil || count != 1 {
		t.Fatalf("expected persisted user, count=%d err=%v", count, err)
	}
	if _, err := connection.ExecContext(ctx, "INSERT INTO users(email, role) VALUES (?, ?)", "EXAMPLE@example.invalid", "employee"); err == nil {
		t.Fatal("duplicate email accepted")
	}
}
