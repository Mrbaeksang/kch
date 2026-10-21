# 배포 준비

## 확정한 방향

- 프론트엔드: Vercel에 정적 웹 배포.
- 백엔드와 DB: Railway의 Go 서버와 SQLite 영구 볼륨.
- Vercel은 사용자의 기존 유료 계정을 사용.
- main 병합 후 배포와 DB 마이그레이션 자동 실행.
- Google 로그인만 허용하며 등록된 직원 이메일만 접근 가능.

## 아직 연결하지 않은 항목

- 프론트엔드 구현과 빌드·테스트 CI.
- Google OAuth 클라이언트와 관리자 지정.
- SQLite 마이그레이션과 복구 방법 구현.
- Vercel·Railway 프로젝트 생성과 GitHub 연동.
- 배포 인증 정보와 운영 환경 변수.
- CI 성공 후에만 운영 배포하도록 연결하고 실패 시 이전 배포 유지 검증.

현재 CI는 Go 서버의 빌드와 테스트를 수행합니다. 클라우드 자동 배포는 아직 연결하지 않았습니다.

## 비용 검토

사용자의 기존 Vercel 유료 계정을 사용합니다. 실제 추가 사용료는 계정 사용량과 배포 후 측정값으로 판단합니다.

Go 서버에 SQLite를 함께 두고 Railway 영구 볼륨에 저장합니다. 별도 DB 서버를 두지 않으며 백엔드 단일 인스턴스 운영, 영구 볼륨, 백업과 복구 절차가 필요합니다. 볼륨 연결 서비스는 재배포 시 짧은 중단이 발생할 수 있습니다.

Railway pre-deploy 단계에서는 볼륨을 마운트하지 않으므로 SQLite 마이그레이션은 볼륨이 연결된 서버 시작 단계에서 HTTP 요청을 받기 전에 실행합니다. 마이그레이션 실패 시 서버를 시작하지 않습니다. 볼륨 재배포와 DB 변경을 포함한 복구 절차는 구현 시 검증합니다.

- https://vercel.com/docs/plans/hobby
- https://docs.railway.com/volumes/reference
- https://docs.railway.com/volumes/backups
- https://docs.railway.com/deployments/pre-deploy-command
