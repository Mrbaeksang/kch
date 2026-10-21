package loans

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/Mrbaeksang/kch/backend/internal/assets"
	"github.com/Mrbaeksang/kch/backend/internal/auth"
	"github.com/go-chi/chi/v5"
	"modernc.org/sqlite"
)

func Register(router chi.Router, database *sql.DB, identity assets.Identity) {
	router.Get("/api/loan-requests", func(writer http.ResponseWriter, request *http.Request) {
		user, err := identity.Current(request)
		if err != nil {
			auth.Reply(writer, 401, map[string]string{"error": "로그인이 필요합니다."})
			return
		}
		if user.Role != "employee" {
			auth.Reply(writer, 403, map[string]string{"error": "직원 계정으로 확인해주세요."})
			return
		}
		rows, err := database.QueryContext(request.Context(), "SELECT r.id,r.asset_id,a.name,a.asset_number,r.due_date,r.status,r.reason,r.created_at FROM loan_requests r JOIN assets a ON a.id=r.asset_id WHERE r.user_id=? ORDER BY r.id DESC", user.ID)
		if err != nil {
			auth.Reply(writer, 500, map[string]string{"error": "신청 목록을 불러오지 못했습니다."})
			return
		}
		defer rows.Close()
		result := make([]map[string]any, 0)
		for rows.Next() {
			var id, assetID int64
			var name, number, date, status, reason, created string
			if err := rows.Scan(&id, &assetID, &name, &number, &date, &status, &reason, &created); err != nil {
				auth.Reply(writer, 500, map[string]string{"error": "신청 목록을 불러오지 못했습니다."})
				return
			}
			result = append(result, map[string]any{"id": id, "assetId": assetID, "assetName": name, "assetNumber": number, "dueDate": date, "status": status, "reason": reason, "createdAt": created})
		}
		if rows.Err() != nil {
			auth.Reply(writer, 500, map[string]string{"error": "신청 목록을 불러오지 못했습니다."})
			return
		}
		auth.Reply(writer, 200, result)
	})
	router.Post("/api/loan-requests/{id}/cancel", func(writer http.ResponseWriter, request *http.Request) {
		user, err := identity.Current(request)
		if err != nil {
			auth.Reply(writer, 401, map[string]string{"error": "로그인이 필요합니다."})
			return
		}
		if user.Role != "employee" {
			auth.Reply(writer, 403, map[string]string{"error": "직원 계정으로 취소해주세요."})
			return
		}
		if !identity.AllowWrite(writer, request) {
			return
		}
		id, err := strconv.ParseInt(chi.URLParam(request, "id"), 10, 64)
		if err != nil || id < 1 {
			auth.Reply(writer, 400, map[string]string{"error": "올바른 신청을 선택해주세요."})
			return
		}
		result, err := database.ExecContext(request.Context(), "UPDATE loan_requests SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='pending'", id, user.ID)
		if err != nil {
			auth.Reply(writer, 500, map[string]string{"error": "신청을 취소하지 못했습니다."})
			return
		}
		count, err := result.RowsAffected()
		if err != nil {
			auth.Reply(writer, 500, map[string]string{"error": "취소 결과를 확인하지 못했습니다."})
			return
		}
		if count == 0 {
			var status string
			err := database.QueryRowContext(request.Context(), "SELECT status FROM loan_requests WHERE id=? AND user_id=?", id, user.ID).Scan(&status)
			if errors.Is(err, sql.ErrNoRows) {
				auth.Reply(writer, 404, map[string]string{"error": "신청을 찾을 수 없습니다."})
				return
			}
			if err != nil {
				auth.Reply(writer, 500, map[string]string{"error": "신청을 확인하지 못했습니다."})
				return
			}
			auth.Reply(writer, 409, map[string]string{"error": "승인 대기 중인 신청만 취소할 수 있습니다."})
			return
		}
		auth.Reply(writer, 200, map[string]any{"id": id, "status": "cancelled"})
	})
	router.Post("/api/loan-requests", func(writer http.ResponseWriter, request *http.Request) {
		user, err := identity.Current(request)
		if err != nil {
			auth.Reply(writer, 401, map[string]string{"error": "로그인이 필요합니다."})
			return
		}
		if user.Role != "employee" {
			auth.Reply(writer, 403, map[string]string{"error": "직원 계정으로 신청해주세요."})
			return
		}
		if !identity.AllowWrite(writer, request) {
			return
		}
		var input struct {
			AssetID int64  `json:"assetId"`
			DueDate string `json:"dueDate"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1024))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF {
			auth.Reply(writer, 400, map[string]string{"error": "신청 정보를 확인해주세요."})
			return
		}
		date, dateError := time.Parse("2006-01-02", input.DueDate)
		today := time.Now().In(time.FixedZone("KST", 9*60*60)).Format("2006-01-02")
		if input.AssetID < 1 || dateError != nil || date.Format("2006-01-02") != input.DueDate || input.DueDate < today {
			auth.Reply(writer, 400, map[string]string{"error": "반납 예정일은 한국 시간 기준 오늘 이후 날짜를 선택해주세요."})
			return
		}
		result, err := database.ExecContext(request.Context(), "INSERT INTO loan_requests(asset_id,user_id,due_date) SELECT id,?,? FROM assets WHERE id=? AND status='available'", user.ID, input.DueDate, input.AssetID)
		if err != nil {
			var sqliteError *sqlite.Error
			if errors.As(err, &sqliteError) && sqliteError.Code() == 2067 {
				auth.Reply(writer, 409, map[string]string{"error": "이미 승인 대기 중인 신청이 있습니다."})
				return
			}
			auth.Reply(writer, 500, map[string]string{"error": "신청을 저장하지 못했습니다."})
			return
		}
		count, err := result.RowsAffected()
		if err != nil {
			auth.Reply(writer, 500, map[string]string{"error": "신청 결과를 확인하지 못했습니다."})
			return
		}
		if count == 0 {
			var exists int
			if err := database.QueryRowContext(request.Context(), "SELECT 1 FROM assets WHERE id=?", input.AssetID).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
				auth.Reply(writer, 404, map[string]string{"error": "장비를 찾을 수 없습니다."})
				return
			} else if err != nil {
				auth.Reply(writer, 500, map[string]string{"error": "장비 상태를 확인하지 못했습니다."})
				return
			}
			auth.Reply(writer, 409, map[string]string{"error": "현재 신청할 수 없는 장비입니다."})
			return
		}
		id, err := result.LastInsertId()
		if err != nil {
			auth.Reply(writer, 500, map[string]string{"error": "신청 결과를 확인하지 못했습니다."})
			return
		}
		auth.Reply(writer, 201, map[string]any{"id": id, "status": "pending", "dueDate": input.DueDate})
	})
}
