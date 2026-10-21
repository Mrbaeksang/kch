# 배포 준비

## 확정한 방향

- 프론트엔드: Vercel에 정적 웹 배포.
- 백엔드와 DB: Railway.
- main 병합 후 배포와 DB 마이그레이션 자동 실행.
- Google 로그인만 허용하며 등록된 직원 이메일만 접근 가능.

## 아직 연결하지 않은 항목

- 프론트엔드 구현과 빌드·테스트 CI.
- Google OAuth 클라이언트와 관리자 지정.
- DB 종류 확정, 마이그레이션과 복구 방법.
- Vercel·Railway 프로젝트 생성과 GitHub 연동.
- 배포 인증 정보와 운영 환경 변수.
- CI 성공 후에만 운영 배포하도록 연결하고 실패 시 이전 배포 유지 검증.

현재 CI는 Go 서버의 빌드와 테스트를 수행합니다. 클라우드 자동 배포는 아직 연결하지 않았습니다.

## 비용 검토

Vercel Hobby는 개인·비상업 용도로 제한됩니다. 사내 업무 서비스는 무료 운영을 전제로 하지 말고 사용 가능한 플랜을 확인합니다.

낮은 동시 쓰기 빈도에서는 Go 서버에 SQLite를 함께 두고 Railway 영구 볼륨에 저장하는 구성을 검토합니다. 별도 DB 서버는 줄일 수 있지만 백엔드 단일 인스턴스 운영, 영구 볼륨, 백업과 복구 절차가 필요합니다. DB는 아직 미확정입니다.

- https://vercel.com/docs/plans/hobby
- https://docs.railway.com/volumes/reference
- https://docs.railway.com/volumes/backups
