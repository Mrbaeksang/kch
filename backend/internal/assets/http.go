package assets

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Mrbaeksang/kch/backend/internal/auth"
	"github.com/go-chi/chi/v5"
	"modernc.org/sqlite"
)

type Identity interface {
	Current(*http.Request) (auth.User, error)
	AllowWrite(http.ResponseWriter, *http.Request) bool
}

type Asset struct {
	ID          int64  `json:"id"`
	AssetNumber string `json:"assetNumber"`
	Name        string `json:"name"`
	Model       string `json:"model"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Location    string `json:"location"`
	Status      string `json:"status"`
}

func decode(writer http.ResponseWriter, request *http.Request) (Asset, bool) {
	var asset Asset
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 16384))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&asset) != nil || decoder.Decode(new(any)) != io.EOF {
		auth.Reply(writer, 400, map[string]string{"error": "입력 내용을 확인해주세요."})
		return asset, false
	}
	asset.AssetNumber = strings.TrimSpace(asset.AssetNumber)
	asset.Name = strings.TrimSpace(asset.Name)
	asset.Model = strings.TrimSpace(asset.Model)
	asset.Category = strings.TrimSpace(asset.Category)
	asset.Location = strings.TrimSpace(asset.Location)
	asset.Description = strings.TrimSpace(asset.Description)
	if asset.AssetNumber == "" || asset.Name == "" || utf8.RuneCountInString(asset.AssetNumber) > 80 || utf8.RuneCountInString(asset.Name) > 120 || utf8.RuneCountInString(asset.Model) > 120 || utf8.RuneCountInString(asset.Category) > 80 || utf8.RuneCountInString(asset.Location) > 120 || utf8.RuneCountInString(asset.Description) > 2000 {
		auth.Reply(writer, 400, map[string]string{"error": "자산번호와 장비명은 필수이며 입력 길이를 확인해주세요."})
		return asset, false
	}
	return asset, true
}

func failure(writer http.ResponseWriter, err error) {
	var sqliteError *sqlite.Error
	if errors.As(err, &sqliteError) && sqliteError.Code() == 2067 {
		auth.Reply(writer, 409, map[string]string{"error": "이미 등록된 자산번호입니다."})
		return
	}
	auth.Reply(writer, 500, map[string]string{"error": "장비 정보를 저장하지 못했습니다."})
}

func Register(router chi.Router, database *sql.DB, identity Identity) {
	authorize := func(writer http.ResponseWriter, request *http.Request, admin bool) bool {
		user, err := identity.Current(request)
		if err != nil {
			auth.Reply(writer, 401, map[string]string{"error": "로그인이 필요합니다."})
			return false
		}
		if admin && user.Role != "admin" {
			auth.Reply(writer, 403, map[string]string{"error": "관리자만 장비를 변경할 수 있습니다."})
			return false
		}
		return !admin || identity.AllowWrite(writer, request)
	}
	readAsset := func(writer http.ResponseWriter, request *http.Request, id int64) {
		var asset Asset
		err := database.QueryRowContext(request.Context(), "SELECT id,asset_number,name,model,category,description,location,status FROM assets WHERE id=?", id).Scan(&asset.ID, &asset.AssetNumber, &asset.Name, &asset.Model, &asset.Category, &asset.Description, &asset.Location, &asset.Status)
		if errors.Is(err, sql.ErrNoRows) {
			auth.Reply(writer, 404, map[string]string{"error": "장비를 찾을 수 없습니다."})
			return
		}
		if err != nil {
			auth.Reply(writer, 500, map[string]string{"error": "장비를 불러오지 못했습니다."})
			return
		}
		auth.Reply(writer, 200, asset)
	}
	router.Get("/api/assets", func(writer http.ResponseWriter, request *http.Request) {
		if !authorize(writer, request, false) {
			return
		}
		rows, err := database.QueryContext(request.Context(), "SELECT id,asset_number,name,model,category,description,location,status FROM assets ORDER BY id DESC")
		if err != nil {
			auth.Reply(writer, 500, map[string]string{"error": "장비 목록을 불러오지 못했습니다."})
			return
		}
		defer rows.Close()
		result := make([]Asset, 0)
		for rows.Next() {
			var asset Asset
			if err := rows.Scan(&asset.ID, &asset.AssetNumber, &asset.Name, &asset.Model, &asset.Category, &asset.Description, &asset.Location, &asset.Status); err != nil {
				auth.Reply(writer, 500, map[string]string{"error": "장비 목록을 불러오지 못했습니다."})
				return
			}
			result = append(result, asset)
		}
		if rows.Err() != nil {
			auth.Reply(writer, 500, map[string]string{"error": "장비 목록을 불러오지 못했습니다."})
			return
		}
		auth.Reply(writer, 200, result)
	})
	router.Get("/api/assets/{id}", func(writer http.ResponseWriter, request *http.Request) {
		if !authorize(writer, request, false) {
			return
		}
		id, err := strconv.ParseInt(chi.URLParam(request, "id"), 10, 64)
		if err != nil || id < 1 {
			auth.Reply(writer, 400, map[string]string{"error": "올바른 장비를 선택해주세요."})
			return
		}
		readAsset(writer, request, id)
	})
	router.Post("/api/assets", func(writer http.ResponseWriter, request *http.Request) {
		if !authorize(writer, request, true) {
			return
		}
		asset, ok := decode(writer, request)
		if !ok {
			return
		}
		if asset.Status != "" && asset.Status != "available" {
			auth.Reply(writer, 400, map[string]string{"error": "신규 장비는 대여 가능 상태로 등록합니다."})
			return
		}
		result, err := database.ExecContext(request.Context(), "INSERT INTO assets(asset_number,name,model,category,description,location) VALUES (?,?,?,?,?,?)", asset.AssetNumber, asset.Name, asset.Model, asset.Category, asset.Description, asset.Location)
		if err != nil {
			failure(writer, err)
			return
		}
		asset.ID, err = result.LastInsertId()
		if err != nil {
			failure(writer, err)
			return
		}
		asset.Status = "available"
		auth.Reply(writer, 201, asset)
	})
	router.Put("/api/assets/{id}", func(writer http.ResponseWriter, request *http.Request) {
		if !authorize(writer, request, true) {
			return
		}
		id, err := strconv.ParseInt(chi.URLParam(request, "id"), 10, 64)
		if err != nil || id < 1 {
			auth.Reply(writer, 400, map[string]string{"error": "올바른 장비를 선택해주세요."})
			return
		}
		asset, ok := decode(writer, request)
		if !ok {
			return
		}
		var status string
		err = database.QueryRowContext(request.Context(), "SELECT status FROM assets WHERE id=?", id).Scan(&status)
		if errors.Is(err, sql.ErrNoRows) {
			auth.Reply(writer, 404, map[string]string{"error": "장비를 찾을 수 없습니다."})
			return
		}
		if err != nil {
			failure(writer, err)
			return
		}
		if asset.Status != "" && asset.Status != status {
			auth.Reply(writer, 409, map[string]string{"error": "장비 상태 변경은 수리·대여 기능에서 처리합니다."})
			return
		}
		_, err = database.ExecContext(request.Context(), "UPDATE assets SET asset_number=?,name=?,model=?,category=?,description=?,location=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", asset.AssetNumber, asset.Name, asset.Model, asset.Category, asset.Description, asset.Location, id)
		if err != nil {
			failure(writer, err)
			return
		}
		readAsset(writer, request, id)
	})
}
