package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Mrbaeksang/kch/backend/internal/database"
	"github.com/go-chi/chi/v5"
)

func TestDevelopmentLoginIsExplicitAndNotProduction(t *testing.T) {
	if auth, err := NewDevelopment(nil, "production", false, ""); err != nil || auth != nil {
		t.Fatal("login should be disabled")
	}
	if _, err := NewDevelopment(nil, "production", true, "http://localhost:5173"); err == nil {
		t.Fatal("production accepted development login")
	}
	if _, err := NewDevelopment(nil, "development", true, "https://public.example"); err == nil {
		t.Fatal("public origin accepted")
	}
}

func TestLoginLogoutAndDisabledAccount(t *testing.T) {
	connection, err := database.Open(context.Background(), filepath.Join(t.TempDir(), "app.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	auth, err := NewDevelopment(connection, "development", true, "http://localhost:5173")
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	auth.Register(router)
	login := func(origin string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/api/auth/dev-login", strings.NewReader(`{"role":"employee"}`))
		request.Header.Set("Origin", origin)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}
	if response := login("https://untrusted.invalid"); response.Code != 403 {
		t.Fatalf("unexpected status %d", response.Code)
	}
	response := login("http://localhost:5173")
	if response.Code != 200 {
		t.Fatalf("login failed: %s", response.Body.String())
	}
	cookie := response.Result().Cookies()[0]
	request := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	request.AddCookie(cookie)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != 200 {
		t.Fatal("session not recognized")
	}
	if _, err := connection.Exec("UPDATE users SET active=0 WHERE email='employee@example.invalid'"); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != 401 {
		t.Fatal("disabled session allowed")
	}
	logout := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logout.AddCookie(cookie)
	logout.Header.Set("Origin", "http://localhost:5173")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, logout)
	if response.Code != 200 {
		t.Fatal("logout failed")
	}
	if _, err := connection.Exec("UPDATE users SET active=1 WHERE email='employee@example.invalid'"); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != 401 {
		t.Fatal("logged out token reused")
	}
}
