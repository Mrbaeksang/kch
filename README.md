# 사내 장비 대여 관리

직원이 개별 장비를 신청하고 관리자 한 명이 대여와 반납을 확인하는 사내 웹서비스입니다.

현재는 요구사항, 협업 규칙, Go 서버 기본 구성과 CI를 준비한 단계입니다. Google 로그인, 장비 관리 화면, 데이터 저장과 클라우드 배포 연결은 구현 전입니다.

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
