package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Mrbaeksang/kch/backend/internal/auth"
	"github.com/Mrbaeksang/kch/backend/internal/database"
	"github.com/Mrbaeksang/kch/backend/internal/httpapi"
)

func main() {
	databasePath := os.Getenv("DATABASE_PATH")
	if databasePath == "" {
		databasePath = "data/app.sqlite"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	connection, err := database.Open(ctx, databasePath)
	cancel()
	if err != nil {
		log.Fatal(err)
	}
	defer connection.Close()
	development, err := auth.NewDevelopment(connection, os.Getenv("APP_ENV"), os.Getenv("DEV_LOGIN_ENABLED") == "true", os.Getenv("DEV_FRONTEND_ORIGIN"))
	if err != nil {
		log.Fatal(err)
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           httpapi.NewRouter(connection, development),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("server listening on port %s", port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
