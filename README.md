# 사내 장비 대여 관리

직원이 개별 장비를 신청하고 관리자 한 명이 대여와 반납을 확인하는 사내 웹서비스입니다.

현재는 개발 테스트 로그인, 관리자 장비 등록·수정, 직원 장비 목록·상세 조회, SQLite 저장과 로컬 Compose 구성이 구현되어 있습니다. Google 로그인, 대여·반납과 클라우드 배포 연결은 구현 전입니다.

## 로컬 실행

Docker가 실행 중인 상태에서 저장소 루트에서 실행합니다.

```sh
docker compose up --build -d
```

- 화면: http://localhost:5173
- 백엔드 상태: http://localhost:8080/healthz
- SQLite 연결 상태: http://localhost:8080/api/readyz

화면 상단에 서비스 연결 여부가 표시됩니다. 로컬 Compose에서는 직원·관리자 테스트 로그인 버튼을 사용할 수 있습니다. Google 로그인과 업무 기능은 아직 구현 전이며 실제 Google 인증 최종 검증은 뒤로 미뤘습니다. Compose는 개발 전용입니다.

SQLite는 Compose의 sqlite-data 영구 볼륨에 저장되며 서버 시작 전에 마이그레이션을 자동 적용합니다. DB 컨테이너는 따로 없습니다. 컨테이너 중지·재생성 후에도 데이터가 유지됩니다.

```sh
docker compose logs --tail=50
docker compose down
```

볼륨 삭제 옵션을 사용하면 로컬 DB도 삭제되므로 데이터 보존이 필요하면 사용하지 않습니다. 프론트는 로컬 개발 서버이며 소스를 바꾼 뒤에는 다시 빌드합니다. 포트는 이 컴퓨터의 루프백에만 공개됩니다.

## 문서

- [요구사항](docs/requirements.md)
- [업무 용어](CONTEXT.md)
- [협업 규칙](CONTRIBUTING.md)
- [배포 준비](docs/deployment.md)

## 개발

Go 1.26 이상에서 다음 명령을 사용합니다.

```sh
cd backend
go run ./cmd/server
go test -race ./...
go build ./...
```

서버는 기본적으로 8080 포트를 사용하며 `PORT`로 변경할 수 있습니다. `/healthz`는 서버 실행 여부만 확인하며 인증이나 데이터베이스 상태를 의미하지 않습니다.

Docker 없이 개발할 경우 백엔드를 실행한 뒤 다른 터미널에서 프론트 폴더로 이동해 npm ci와 npm run dev를 실행합니다. 설정 예시는 .env.example에 있으며 Go 서버는 .env 파일을 자동으로 읽지 않으므로 필요한 값은 프로세스 환경 변수로 전달합니다.
