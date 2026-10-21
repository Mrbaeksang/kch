package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

type User struct {
	ID     int64  `json:"id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Active bool   `json:"active"`
}

type session struct {
	UserID  int64
	Expires time.Time
}

type Development struct {
	database *sql.DB
	origin   string
	mutex    sync.Mutex
	sessions map[string]session
}

func NewDevelopment(database *sql.DB, environment string, enabled bool, origin string) (*Development, error) {
	if !enabled {
		return nil, nil
	}
	if environment != "development" {
		return nil, errors.New("development login requires APP_ENV=development")
	}
	if origin != "http://localhost:5173" && origin != "http://127.0.0.1:5173" {
		return nil, errors.New("development login requires a loopback frontend origin")
	}
	for _, account := range []struct{ email, role string }{{"admin@example.invalid", "admin"}, {"employee@example.invalid", "employee"}} {
		if _, err := database.Exec("INSERT INTO users(email, role) VALUES (?, ?) ON CONFLICT(email) DO NOTHING", account.email, account.role); err != nil {
			return nil, err
		}
	}
	return &Development{database: database, origin: origin, sessions: make(map[string]session)}, nil
}

func Reply(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.Header().Set("Cache-Control", "no-store")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func (development *Development) Current(request *http.Request) (User, error) {
	var user User
	cookie, err := request.Cookie("kch_dev_session")
	if err != nil {
		return user, err
	}
	development.mutex.Lock()
	entry, exists := development.sessions[cookie.Value]
	if exists && time.Now().After(entry.Expires) {
		delete(development.sessions, cookie.Value)
		exists = false
	}
	development.mutex.Unlock()
	if !exists {
		return user, errors.New("invalid session")
	}
	err = development.database.QueryRowContext(request.Context(), "SELECT id,email,role,active FROM users WHERE id=? AND active=1", entry.UserID).Scan(&user.ID, &user.Email, &user.Role, &user.Active)
	return user, err
}

func (development *Development) AllowWrite(writer http.ResponseWriter, request *http.Request) bool {
	if request.Header.Get("Origin") != development.origin {
		Reply(writer, http.StatusForbidden, map[string]string{"error": "허용되지 않은 요청입니다."})
		return false
	}
	return true
}

func (development *Development) Register(router chi.Router) {
	router.Get("/api/auth/me", func(writer http.ResponseWriter, request *http.Request) {
		user, err := development.Current(request)
		if err != nil {
			Reply(writer, 401, map[string]string{"error": "로그인이 필요합니다."})
			return
		}
		Reply(writer, 200, user)
	})
	router.Post("/api/auth/dev-login", func(writer http.ResponseWriter, request *http.Request) {
		if !development.AllowWrite(writer, request) {
			return
		}
		var input struct {
			Role string `json:"role"`
		}
		if json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1024)).Decode(&input) != nil || (input.Role != "employee" && input.Role != "admin") {
			Reply(writer, 400, map[string]string{"error": "테스트 계정을 선택해주세요."})
			return
		}
		var user User
		email := input.Role + "@example.invalid"
		if err := development.database.QueryRowContext(request.Context(), "SELECT id,email,role,active FROM users WHERE email=? AND role=? AND active=1", email, input.Role).Scan(&user.ID, &user.Email, &user.Role, &user.Active); err != nil {
			Reply(writer, 403, map[string]string{"error": "사용할 수 없는 계정입니다."})
			return
		}
		token := rand.Text()
		development.mutex.Lock()
		for key, value := range development.sessions {
			if value.UserID == user.ID || time.Now().After(value.Expires) {
				delete(development.sessions, key)
			}
		}
		development.sessions[token] = session{UserID: user.ID, Expires: time.Now().Add(8 * time.Hour)}
		development.mutex.Unlock()
		http.SetCookie(writer, &http.Cookie{Name: "kch_dev_session", Value: token, Path: "/api", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 28800})
		Reply(writer, 200, user)
	})
	router.Post("/api/auth/logout", func(writer http.ResponseWriter, request *http.Request) {
		if !development.AllowWrite(writer, request) {
			return
		}
		if cookie, err := request.Cookie("kch_dev_session"); err == nil {
			development.mutex.Lock()
			delete(development.sessions, cookie.Value)
			development.mutex.Unlock()
		}
		http.SetCookie(writer, &http.Cookie{Name: "kch_dev_session", Path: "/api", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1})
		Reply(writer, 200, map[string]bool{"ok": true})
	})
}
