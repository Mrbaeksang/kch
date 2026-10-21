# 로컬 개발 상태

## 실행

저장소 루트에서 docker compose up --build -d로 실행한다. 화면은 http://localhost:5173, API는 http://localhost:8080에 연결된다. 프론트는 /api 요청을 Compose 내부 백엔드로 프록시하므로 브라우저에 내부 호스트 이름을 노출하지 않는다.

## 구성

- 프론트는 app, features/auth, lib부터 시작한다. assets, loans, employees와 공통 components는 실제 기능 구현 시 추가한다.
- 백엔드는 cmd/server, internal/httpapi, internal/database, internal/auth, internal/assets와 embedded migrations를 사용한다. loans는 아직 구현 전이며 직원 관리 화면은 제외했다.
- SQLite 파일은 sqlite-data 볼륨에 남는다. 서버 시작 시 사용자 테이블 마이그레이션을 적용하며 허용 계정이나 관리자를 자동 생성하지 않는다.
- 개발 로그인 뒤 장비 목록·상세 API를 조회할 수 있다. 등록·수정 API는 서버에서 관리자 역할과 요청 Origin을 확인한다. 운영 인증이 연결되기 전에는 장비 API도 개발 모드에서만 연결한다.
- 사용자의 요청에 따라 Google 로그인 최종 검증은 뒤로 미루고 관리자 1명과 직원 A·B 2명의 개발 테스트 로그인을 제공한다. 계정은 admin@example.invalid, employee@example.invalid, employee-b@example.invalid이며 비밀번호 없이 버튼으로 선택한다.
- APP_ENV=development와 DEV_LOGIN_ENABLED=true를 함께 지정하고 허용된 로컬 프론트 Origin을 설정해야 테스트 로그인이 켜진다. 기본값은 비활성이고 운영 환경에서 활성화를 요청하면 서버 시작을 거절한다. Compose는 로컬 개발 전용이며 운영에 그대로 배포하지 않는다.
- 테스트 계정은 해당 설정으로 시작할 때만 DB에 생성한다. HttpOnly·SameSite 쿠키에 무작위 세션 식별자를 보관하고 실제 역할·활성 상태는 매 요청 DB에서 조회한다. 세션은 재시작 시 사라지며 Google 운영 세션 구현을 대신하지 않는다.

## 검증

Go 테스트는 파일 기반 DB에 가상 사용자를 저장한 뒤 재연결해 보존과 중복 이메일 제약을 확인한다. HTTP 준비 상태는 DB 연결 종료 시 실패해야 한다. 프론트 테스트는 연결 성공·실패 표시와 미완료 로그인 비활성 상태를 확인한다.

두 컨테이너를 재생성한 뒤 준비 상태와 SQLite 파일 보존을 확인한다. 이는 백업 복원 검증을 대신하지 않는다.

## 다음 작업

장비 목록·검색·상세와 관리자 등록·수정은 #4의 로컬 구현까지 완료했다. 화면 확인용 DEMO-001 장비를 로컬 DB에 등록했다. 대여 가능 상태로 신규 등록하며 수리 상태 변경과 삭제는 #9에서 구현한다. 직원 계정에는 등록·수정 버튼을 제공하지 않고 API도 거절한다.

사용자는 테스트 계정으로 다음 업무 기능 개발을 진행하고 실제 Google 로그인은 최종 검증 때 연결하기로 했다. 티켓 #2의 Google OAuth·OIDC와 운영 관리자 최초 지정·운영 세션 검증은 아직 미완료다. 운영 인증 정보와 도메인은 아직 제공되지 않았다.
