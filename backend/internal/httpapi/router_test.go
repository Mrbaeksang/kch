package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/Mrbaeksang/kch/backend/internal/database"
)

func TestHealthCheck(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()
	NewRouter(nil, nil).ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", response.Code)
	}
	if response.Header().Get("Content-Type") != "application/json" {
		t.Fatal("expected JSON response")
	}
	if response.Body.String() != `{"status":"ok"}` {
		t.Fatalf("unexpected health response: %s", response.Body.String())
	}
}

func TestReadinessTracksDatabaseConnection(t *testing.T) {
	connection, err := database.Open(context.Background(), filepath.Join(t.TempDir(), "app.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	router := NewRouter(connection, nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/readyz", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected ready server, got %d", response.Code)
	}
	connection.Close()
	response = httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/readyz", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected unavailable database, got %d", response.Code)
	}
}

func TestHealthCheckRejectsWrites(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	response := httptest.NewRecorder()
	NewRouter(nil, nil).ServeHTTP(response, request)
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405, got %d", response.Code)
	}
}
