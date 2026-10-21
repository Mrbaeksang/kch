package httpapi

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/Mrbaeksang/kch/backend/internal/assets"
	"github.com/Mrbaeksang/kch/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

func NewRouter(database *sql.DB, development *auth.Development) http.Handler {
	router := chi.NewRouter()
	router.Get("/api/auth/config", func(writer http.ResponseWriter, request *http.Request) {
		auth.Reply(writer, 200, map[string]bool{"developmentLogin": development != nil})
	})
	if development != nil {
		development.Register(router)
		assets.Register(router, database, development)
	}
	router.Get("/healthz", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(`{"status":"ok"}`))
	})
	router.Get("/api/readyz", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
		defer cancel()
		if database == nil || database.PingContext(ctx) != nil {
			writer.WriteHeader(http.StatusServiceUnavailable)
			_, _ = writer.Write([]byte(`{"status":"unavailable"}`))
			return
		}
		_, _ = writer.Write([]byte(`{"status":"ok","database":"connected"}`))
	})
	return router
}
