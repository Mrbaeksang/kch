package loans_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Mrbaeksang/kch/backend/internal/auth"
	"github.com/Mrbaeksang/kch/backend/internal/database"
	"github.com/Mrbaeksang/kch/backend/internal/httpapi"
)

type fixture struct {
	database *sql.DB
	router   http.Handler
	employee *http.Cookie
	admin    *http.Cookie
	date     string
}

func setup(t *testing.T) *fixture {
	t.Helper()
	connection, err := database.Open(context.Background(), filepath.Join(t.TempDir(), "app.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { connection.Close() })
	identity, err := auth.NewDevelopment(connection, "development", true, "http://localhost:5173")
	if err != nil {
		t.Fatal(err)
	}
	location, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		t.Fatal(err)
	}
	fixture := &fixture{database: connection, router: httpapi.NewRouter(connection, identity), date: time.Now().In(location).AddDate(0, 0, 1).Format("2006-01-02")}
	fixture.employee = fixture.call("POST", "/api/auth/dev-login", `{"role":"employee"}`, nil).Result().Cookies()[0]
	fixture.admin = fixture.call("POST", "/api/auth/dev-login", `{"role":"admin"}`, nil).Result().Cookies()[0]
	response := fixture.call("POST", "/api/assets", `{"assetNumber":"REQ-001","name":"테스트 장비"}`, fixture.admin)
	if response.Code != 201 {
		t.Fatal(response.Body.String())
	}
	return fixture
}

func (fixture *fixture) call(method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Origin", "http://localhost:5173")
	if cookie != nil {
		request.AddCookie(cookie)
	}
	response := httptest.NewRecorder()
	fixture.router.ServeHTTP(response, request)
	return response
}

func TestEmployeeSubmitsRequestWithReturnDate(t *testing.T) {
	fixture := setup(t)
	response := fixture.call("POST", "/api/loan-requests", `{"assetId":1,"dueDate":"`+fixture.date+`"}`, fixture.employee)
	if response.Code != 201 {
		t.Fatalf("expected created request, got %d: %s", response.Code, response.Body.String())
	}
	var result struct {
		ID      int64  `json:"id"`
		Status  string `json:"status"`
		DueDate string `json:"dueDate"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ID < 1 || result.Status != "pending" || result.DueDate != fixture.date {
		t.Fatalf("unexpected request: %+v", result)
	}
}

func TestRequestRequiresValidReturnDateAndEmployee(t *testing.T) {
	fixture := setup(t)
	for _, date := range []string{"", "2026-02-30", "2000-01-01", "2099-01-01T00:00:00Z"} {
		response := fixture.call("POST", "/api/loan-requests", `{"assetId":1,"dueDate":"`+date+`"}`, fixture.employee)
		if response.Code != 400 {
			t.Fatalf("date %q accepted: %d", date, response.Code)
		}
	}
	response := fixture.call("POST", "/api/loan-requests", `{"assetId":1,"dueDate":"`+fixture.date+`"}`, fixture.admin)
	if response.Code != 403 {
		t.Fatal("administrator submitted an employee request")
	}
}

func TestUnavailableAssetsAndDuplicatePendingRequestsAreRejected(t *testing.T) {
	fixture := setup(t)
	body := `{"assetId":1,"dueDate":"` + fixture.date + `"}`
	if response := fixture.call("POST", "/api/loan-requests", body, fixture.employee); response.Code != 201 {
		t.Fatal(response.Body.String())
	}
	if response := fixture.call("POST", "/api/loan-requests", body, fixture.employee); response.Code != 409 {
		t.Fatalf("duplicate request: %d", response.Code)
	}
	for _, status := range []string{"repair", "loaned", "archived"} {
		if _, err := fixture.database.Exec("UPDATE assets SET status=? WHERE id=1", status); err != nil {
			t.Fatal(err)
		}
		if response := fixture.call("POST", "/api/loan-requests", body, fixture.employee); response.Code != 409 {
			t.Fatalf("status %s accepted: %d", status, response.Code)
		}
	}
	if response := fixture.call("POST", "/api/loan-requests", `{"assetId":999,"dueDate":"`+fixture.date+`"}`, fixture.employee); response.Code != 404 {
		t.Fatal("missing asset accepted")
	}
}

func TestEmployeeListsAndCancelsOnlyOwnPendingRequest(t *testing.T) {
	fixture := setup(t)
	body := `{"assetId":1,"dueDate":"` + fixture.date + `"}`
	if response := fixture.call("POST", "/api/loan-requests", body, fixture.employee); response.Code != 201 {
		t.Fatal(response.Body.String())
	}
	secondEmployee := fixture.call("POST", "/api/auth/dev-login", `{"role":"employee","account":"employee-b"}`, nil).Result().Cookies()[0]
	if response := fixture.call("POST", "/api/loan-requests", body, secondEmployee); response.Code != 201 {
		t.Fatal(response.Body.String())
	}
	response := fixture.call("GET", "/api/loan-requests?userId=3", "", fixture.employee)
	if response.Code != 200 {
		t.Fatalf("list: %d %s", response.Code, response.Body.String())
	}
	var rows []struct {
		ID        int64  `json:"id"`
		Status    string `json:"status"`
		AssetName string `json:"assetName"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &rows); err != nil || len(rows) != 1 || rows[0].ID != 1 || rows[0].AssetName != "테스트 장비" {
		t.Fatal("other employee request exposed", response.Body.String())
	}
	if response := fixture.call("POST", "/api/loan-requests/2/cancel", "{}", fixture.employee); response.Code != 404 {
		t.Fatal("other employee request cancelled")
	}
	if response := fixture.call("POST", "/api/loan-requests/1/cancel", "{}", fixture.employee); response.Code != 200 {
		t.Fatalf("cancel: %d", response.Code)
	}
	response = fixture.call("GET", "/api/loan-requests", "", fixture.employee)
	if err := json.Unmarshal(response.Body.Bytes(), &rows); err != nil || len(rows) != 1 || rows[0].Status != "cancelled" {
		t.Fatal("cancelled state not visible", response.Body.String())
	}
	if response := fixture.call("POST", "/api/loan-requests/1/cancel", "{}", fixture.employee); response.Code != 409 {
		t.Fatal("cancelled request cancelled again")
	}
	if response := fixture.call("POST", "/api/loan-requests", body, fixture.employee); response.Code != 201 {
		t.Fatal("reapply after cancellation blocked")
	}
	if response := fixture.call("GET", "/api/loan-requests", "", nil); response.Code != 401 {
		t.Fatal("anonymous history exposed")
	}
}

func TestConcurrentDuplicateRequestCreatesOnlyOnePendingRequest(t *testing.T) {
	fixture := setup(t)
	codes := make(chan int, 2)
	var group sync.WaitGroup
	for range 2 {
		group.Add(1)
		go func() {
			defer group.Done()
			codes <- fixture.call("POST", "/api/loan-requests", `{"assetId":1,"dueDate":"`+fixture.date+`"}`, fixture.employee).Code
		}()
	}
	group.Wait()
	close(codes)
	counts := map[int]int{}
	for code := range codes {
		counts[code]++
	}
	if counts[201] != 1 || counts[409] != 1 {
		t.Fatalf("unexpected concurrent results: %v", counts)
	}
}

func TestDifferentEmployeesCanApplyAndProcessedRequestsCannotBeCancelled(t *testing.T) {
	fixture := setup(t)
	body := `{"assetId":1,"dueDate":"` + fixture.date + `"}`
	if response := fixture.call("POST", "/api/loan-requests", body, fixture.employee); response.Code != 201 {
		t.Fatal(response.Body.String())
	}
	secondEmployee := fixture.call("POST", "/api/auth/dev-login", `{"role":"employee","account":"employee-b"}`, nil).Result().Cookies()[0]
	if response := fixture.call("POST", "/api/loan-requests", body, secondEmployee); response.Code != 201 {
		t.Fatal("another employee could not apply", response.Body.String())
	}
	if _, err := fixture.database.Exec("UPDATE loan_requests SET status='approved' WHERE id=1"); err != nil {
		t.Fatal(err)
	}
	if response := fixture.call("POST", "/api/loan-requests/1/cancel", "{}", fixture.employee); response.Code != 409 {
		t.Fatal("processed request cancelled")
	}
}
