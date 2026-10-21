# Go 백엔드 라이브러리 조사

조사일: 2026-10-21. 아래 내용은 도입 추천이며 확정된 기술 결정이나 구현 완료를 뜻하지 않는다. 공식 문서·저장소만 확인했다.

## 추천 구성

| 역할 | 추천 | 이 서비스에 맞는 이유 |
| --- | --- | --- |
| HTTP API | chi | 작은 라우터와 표준 `net/http` 호환성을 유지하면서 그룹별 인증·권한 미들웨어를 구성한다. |
| SQL 접근 | Go `database/sql` + 명시적인 SQL | 승인과 자동 거절을 한 트랜잭션으로 묶는 업무 규칙을 직접 드러낼 수 있다. |
| SQLite 드라이버 | `modernc.org/sqlite` | CGO 없이 빌드하여 CI와 컨테이너 구성을 단순하게 유지한다. |
| DB 변경 관리 | `pressly/goose/v3` | SQL 마이그레이션을 버전으로 관리하고 앱에 포함할 수 있다. |
| Google 로그인 | `golang.org/x/oauth2` + `coreos/go-oidc/v3` | 인증 코드 교환과 ID 토큰 검증의 역할을 분리한다. |
| 서버 세션 | `alexedwards/scs/v2` 조건부 | 로그인 상태를 서버에 보관하고 로그아웃·권한 변경을 처리한다. SQLite 저장 어댑터의 구현·검증 비용을 확인한 뒤 확정한다. |
| 로그·기본 테스트 | 표준 `log/slog`, `testing`, `httptest` | 별도 운영 서버와 유료 서비스 없이 구조화 로그와 API 테스트를 구성한다. |

프레임워크별 메모리·CPU 비용은 현재 서비스 부하로 측정하지 않았다. Gin 대신 chi를 쓰면 Railway 요금이 얼마 줄어든다는 주장은 하지 않는다. 별도 PostgreSQL·Redis 서비스 없이 Go 프로세스와 SQLite 볼륨으로 시작하는 구성이 비용 우선 요구에 부합한다는 것은 이 프로젝트에 대한 설계 판단이다.

## Gin · chi · Echo

| 후보 | 공식 특성 | 판단 |
| --- | --- | --- |
| [Gin](https://github.com/gin-gonic/gin) | JSON 바인딩·검증, 라우트 그룹, 복구 및 로깅 미들웨어, 프레임워크 전용 Context | 생산성 중심 대안. CRUD와 폼 검증을 한 프레임워크에 모으려면 적합하다. |
| [chi](https://github.com/go-chi/chi) | 표준 `net/http` 핸들러 호환, 외부 의존성이 없는 작은 라우터, 라우트 그룹과 미들웨어 | 추천. 경량 요구와 기존 표준 HTTP 서버에 맞는다. JSON 오류 응답과 검증 연결은 직접 구성한다. |
| [Echo](https://github.com/labstack/echo) | 바인딩, 선택적 검증 연결, 중앙 오류 처리, 표준 핸들러 래핑 | 충분히 적합하다. 이번 요구에서 치환을 정당화할 추가 이점은 확인하지 못했다. |

세 후보 모두 MIT이며 조사 시점 GitHub API에서 archived=false였다. GitHub API 별 수는 Gin 89,400, chi 22,975, Echo 32,776으로 확인했다. 별 수는 현재 관심 규모의 참고이며 안정성이나 비용 성능의 증거가 아니다. 정확한 최소 Go 버전과 메이저 버전은 실제 의존성 고정 시 태그의 go.mod를 다시 확인한다.

## SQLite 드라이버와 데이터 접근

- [modernc SQLite](https://pkg.go.dev/modernc.org/sqlite)는 CGO 없는 `database/sql` 드라이버다. BSD-3-Clause이며 GitHub 저장소는 미러이고 원본 개발 저장소는 GitLab이다. 빌드 편의 때문에 추천하며 메모리·처리 속도가 mattn보다 낫다고 판단한 것은 아니다.
- [mattn/go-sqlite3](https://github.com/mattn/go-sqlite3)는 MIT인 SQLite 드라이버이며 CGO와 GCC가 필요하다. C 도구 체인이 허용되고 검증한 성능이 유리하면 선택할 수 있는 대안이다.
- 초기에는 작은 쿼리 집합을 명시적으로 작성하고 바인딩 인자를 사용한다. SQL이 많아질 때 sqlc 코드 생성을 재검토한다. ORM을 도입해도 중복 승인 방지와 상태 전이 규칙은 별도로 설계해야 한다.
- 운영 DB 경로는 Railway 볼륨 아래로 고정한다. `foreign_keys`, `busy_timeout`과 연결 수를 명시하고 쓰기 트랜잭션을 짧게 유지한다. 낮은 쓰기 빈도에서는 우선 연결 하나로 직렬화하는 구성을 검증할 수 있다.
- WAL 사용 여부는 운영 설정으로 결정한다. [SQLite WAL 문서](https://sqlite.org/wal.html)는 읽기·쓰기 동시 진행이 가능해도 쓰기는 한 번에 하나임을 설명한다. 실제 드라이버에 포함된 SQLite 엔진 버전을 확인하고 WAL-reset 수정 버전(3.51.3 이상 또는 공식 백포트)이 반영되었는지 점검한다.

## 중복 승인과 자동 거절

아래는 구현 제안이다. 관리자 한 명이어도 더블 클릭·네트워크 재시도·여러 탭은 발생하므로 DB에서 보장한다.

1. 승인 트랜잭션에서 신청이 대기 중이고 장비가 사용 가능인지 확인한다.
2. 조건을 포함한 상태 변경의 영향 행 수를 검사해 승인 성공을 판단한다.
3. 동일 트랜잭션에서 나머지 대기 신청을 자동 거절하고 이력을 남긴다.
4. [SQLite 부분 UNIQUE 인덱스](https://sqlite.org/lang_createindex.html)로 자산별 진행 중 대여 한 건만 허용한다. 진행 중에는 반납 요청 상태도 포함한다.
5. 수리 전환·보관 전환의 신청 차단과 기존 대기 신청 거절도 트랜잭션으로 묶는다. 이미 대여 중인 장비의 수리 전환 정책은 별도 업무 결정이 필요하다.

## Google 로그인과 세션

- [x/oauth2](https://pkg.go.dev/golang.org/x/oauth2)는 인증 코드 교환을 담당하고 [go-oidc](https://github.com/coreos/go-oidc)는 ID 토큰 검증을 담당한다. 로그인만 필요하므로 Google API 접근용 refresh token은 기본적으로 저장하지 않는다.
- [Google OIDC 문서](https://developers.google.com/identity/openid-connect/openid-connect)에 따라 issuer, audience, 만료, 서명 및 nonce를 검증한다. OAuth state와 PKCE를 사용하고 검증된 이메일이 허용 목록에 있으며 활성 상태인지 서버에서 검사한다. Google `sub`를 계정 식별자로 저장한다.
- [SCS](https://github.com/alexedwards/scs)는 서버 세션 및 토큰 갱신을 지원한다. 기본 메모리 저장소는 재시작 시 세션이 사라진다. 공식 sqlite3store는 mattn CGO 드라이버를 기준으로 하므로 modernc와의 SQL·오류 동작을 검증하거나 작은 Store 구현이 필요하다. 별도 Redis는 도입하지 않는 구성을 추천한다.
- 배포 후에는 로그인·로그아웃 시 토큰 갱신과 만료를 적용하고 직원 비활성화 이후에도 기존 세션이 접근하지 못하도록 매 요청 권한을 확인한다.
- Vercel 프론트와 Railway API는 가능한 동일 도메인의 하위 도메인으로 제공한다. 서로 다른 기본 도메인을 그대로 쓰면 교차 사이트 쿠키 제한을 고려해야 한다. 동일 출처 API 프록시 또는 자체 도메인을 먼저 정하고 `Secure`, `HttpOnly`, `SameSite`, CSRF 및 CORS를 그 배치에 맞춰 설정한다.

## Railway 배포·마이그레이션·복구

- [Railway 볼륨](https://docs.railway.com/volumes/reference)은 재배포 후에도 데이터를 보존한다. 볼륨 연결 서비스는 replica를 사용할 수 없고 배포 교체 시 잠깐 중단된다. 첫 버전은 단일 인스턴스로 운영한다.
- [goose](https://github.com/pressly/goose)는 MIT이며 SQL 마이그레이션과 embedded migrations를 지원한다. 앱에 필요한 라이브러리 방식으로 포함하면 모든 DB 드라이버를 포함한 범용 CLI를 운영 이미지에 추가할 필요가 없다.
- [Railway pre-deploy 문서](https://docs.railway.com/deployments/pre-deploy-command)는 볼륨·파일시스템 읽기와 쓰기를 start command에서 수행하도록 명시한다. 따라서 시작 순서는 볼륨 확인 → 백업 필요 여부 확인 → 마이그레이션 → HTTP 서버 시작이다. 실패하면 서버를 준비 완료로 표시하지 않는다.
- DB 구조 변경은 이전 앱도 읽을 수 있는 추가 방식부터 적용하고 데이터 삭제는 분리한다. 앱 롤백만으로 DB 구조가 자동 복원된다고 가정하지 않는다.
- 영구볼륨과 백업은 다르다. [SQLite Online Backup 또는 VACUUM INTO](https://sqlite.org/backup.html)를 사용한 일관된 백업과 복구 시험을 배포 전에 정한다. 실행 중 DB 파일 하나만 복사하는 방식은 피한다. Railway 볼륨 백업의 보관 기간·복원 절차도 실제 계정에서 확인한다.

## 도입 전 확인

- 실제 태그를 고정하여 Go 버전·라이선스·취약점 및 SQLite 엔진 패치를 확인한다.
- 중복 승인, 승인 대 수리 전환, 반납 요청 거절, 비활성 직원의 기존 세션 차단을 DB 통합 테스트로 검증한다.
- 테스트용 SQLite도 운영과 동일한 드라이버·제약조건을 사용한다.
- Google 자격 증명, 관리자 지정, 배포 도메인, 백업 보존 기간은 아직 운영 설정이 필요하다.
