package assets_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Mrbaeksang/kch/backend/internal/auth"
	"github.com/Mrbaeksang/kch/backend/internal/database"
	"github.com/Mrbaeksang/kch/backend/internal/httpapi"
)

func TestAssetManagementAndEmployeeReadOnly(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.sqlite")
	connection, err := database.Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	identity, err := auth.NewDevelopment(connection, "development", true, "http://localhost:5173")
	if err != nil {
		t.Fatal(err)
	}
	router := httpapi.NewRouter(connection, identity)
	call := func(method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Origin", "http://localhost:5173")
		if cookie != nil {
			request.AddCookie(cookie)
		}
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}
	login := func(role string) *http.Cookie {
		response := call("POST", "/api/auth/dev-login", `{"role":"`+role+`"}`, nil)
		if response.Code != 200 {
			t.Fatal(response.Body.String())
		}
		return response.Result().Cookies()[0]
	}
	admin := login("admin")
	employee := login("employee")
	body := `{"assetNumber":"KCH-001","name":"업무용 노트북","model":"MacBook Air","category":"노트북","location":"사무실","description":"충전기 포함"}`
	if response := call("GET", "/api/assets", "", nil); response.Code != 401 {
		t.Fatal("anonymous access allowed")
	}
	if response := call("POST", "/api/assets", body, employee); response.Code != 403 {
		t.Fatal("employee created asset")
	}
	response := call("POST", "/api/assets", body, admin)
	if response.Code != 201 {
		t.Fatalf("create failed: %d %s", response.Code, response.Body.String())
	}
	if response := call("POST", "/api/assets", strings.ReplaceAll(body, "KCH-001", "kch-001"), admin); response.Code != 409 {
		t.Fatalf("duplicate not rejected: %d", response.Code)
	}
	if response := call("POST", "/api/assets", `{"name":"test"}`, admin); response.Code != 400 {
		t.Fatal("missing number accepted")
	}
	if response := call("PUT", "/api/assets/1", body, employee); response.Code != 403 {
		t.Fatal("employee edited asset")
	}
	response = call("PUT", "/api/assets/1", strings.ReplaceAll(body, "사무실", "2층 장비실"), admin)
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	response = call("GET", "/api/assets/1", "", employee)
	if response.Code != 200 || !strings.Contains(response.Body.String(), "2층 장비실") {
		t.Fatal("employee cannot read updated detail")
	}
	response = call("GET", "/api/assets", "", employee)
	var rows []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &rows); err != nil || len(rows) != 1 {
		t.Fatal("unexpected list", response.Body.String())
	}
	if response := call("GET", "/api/assets/999", "", employee); response.Code != 404 {
		t.Fatal("missing asset not reported")
	}
	if response := call("PUT", "/api/assets/1", strings.Replace(body, `"name":`, `"status":"repair","name":`, 1), admin); response.Code != 409 {
		t.Fatal("status edited through basic form")
	}
	connection.Close()
	reopened, err := database.Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	identity, err = auth.NewDevelopment(reopened, "development", true, "http://localhost:5173")
	if err != nil {
		t.Fatal(err)
	}
	router = httpapi.NewRouter(reopened, identity)
	employee = login("employee")
	response = call("GET", "/api/assets/1", "", employee)
	if response.Code != 200 || !strings.Contains(response.Body.String(), "2층 장비실") {
		t.Fatal("asset did not survive restart")
	}
}
