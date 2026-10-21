# KCH 팀 개발 지침

## 프로젝트와 기준 문서

- 사내 장비 대여 서비스다. React·Vite·TypeScript, Go·chi, SQLite를 사용한다.
- 업무 용어는 `CONTEXT.md`, 요구사항은 관련 GitHub 이슈, 중요한 결정은 `docs/adr/`를 따른다.
- 이슈는 GitHub `Mrbaeksang/kch`에서 관리한다. 이슈·라벨·도메인 운영 상세는 관련 작업 시 `docs/agents/`에서 읽는다.
- 진행 상태는 이슈에 남기고 이 파일에는 지속되는 팀 규칙만 기록한다.

## 공통 원칙

- 변경 전에 이슈와 기존 코드를 확인한다. 중요한 가정과 선택 이유를 알리고 결과에 영향을 주는 모호함만 질문한다.
- 요청을 만족하는 가장 단순한 구현을 선택한다. 요청하지 않은 기능이나 미래를 위한 추상화를 추가하지 않는다.
- 필요한 부분만 수정하고 다른 사람의 미완료 변경을 보존한다. 무관한 정리·리팩터링은 별도로 제안한다.
- 사용자가 관찰할 수 있는 동작과 실제 검증 결과로 완료를 판단한다.

## 작업별 지침 — 해당 작업 시에만 읽기

| 작업 | 읽을 스킬 |
| --- | --- |
| 기능 구현·버그 수정 | `.agents/skills/kch-implement/SKILL.md` |
| 변경 코드 리뷰 | `.agents/skills/kch-review/SKILL.md` |
| 커밋 작성·생성 | `.agents/skills/kch-commit/SKILL.md` |
| PR 작성·수정 | `.agents/skills/kch-pr/SKILL.md` |

모든 스킬을 미리 읽지 않는다. 해당 스킬을 실제로 읽고 적용한다. 개인 PC의 절대 경로나 개인 스킬 설치를 전제하지 않는다.

## 실행과 검사

아래 명령은 저장소 루트 기준이다. Compose는 Docker가 실행 중이어야 한다.

```sh
docker compose up --build -d
docker compose ps
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run build
cd backend
go test -race ./...
go vet ./...
go build ./...
```

- 화면은 `http://localhost:5173`, 백엔드는 `http://localhost:8080`이다.
- 변경한 동작부터 검사하고 완료 전 관련 전체 검사와 빌드를 수행한다. 실행하지 못한 검사는 이유를 남긴다.
- 개발은 테스트 직원·관리자 각 1명으로 진행한다. 실제 Google 인증은 최종 검증하며 개발 로그인은 운영에 노출하지 않는다.
- SQLite는 영구 볼륨에 저장한다. 보존이 필요한 볼륨이나 DB를 임의로 삭제하지 않는다.

## 협업과 완료 보고

- 이슈별 담당자와 작업 브랜치를 구분한다. 브랜치는 `feature/설명`, `fix/설명`, `docs/설명`, `setup/설명` 형식의 짧은 영문 이름을 사용한다.
- main 직접 push·강제 push를 하지 않는다. 병합은 필수 CI 통과 후 Squash 방식으로 한다.
- 커밋·PR 제목은 사용자에게 달라진 점을 설명하는 한국어 한 문장으로 쓴다. 상세 협업 안내는 `CONTRIBUTING.md`를 따른다.
- 커밋·push·PR·병합은 사용자가 요청한 범위에서 수행한다. 다른 사람의 변경을 임의로 포함하지 않는다.
- 보고는 달라진 점, 실제 검증 결과, 남은 일 순서로 적는다. 로컬 구현·커밋·push·PR·CI·main 반영·배포를 구분한다.
- 비밀키·실제 직원 정보·운영 DB·세션 정보를 공개 저장소·로그·첨부 화면에 노출하지 않는다.

## Code Review Rules

권한 우회, 잘못된 대여 상태 전이, SQLite 트랜잭션·영속성 문제, 운영에 노출된 개발 로그인을 우선 검토한다. 상세 절차는 `kch-review` 스킬을 따른다.
