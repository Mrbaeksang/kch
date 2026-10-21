# 요구사항에 맞는 오픈소스 구성 조사

조사일: 2026-10-21 KST. SQLite 영구 볼륨과 Vercel 유료 계정은 확정 사항이며 아래 라이브러리는 추천안이다. 아직 설치하거나 기존 서버를 교체하지 않았다.

## 선정 기준

장비 등록·신청·승인·반납 업무에 직접 필요한 기능, 공식 문서와 유지보수 상태, 불필요한 서버 비용과 의존성 감소를 기준으로 판단했다. GitHub 별 수는 사용 규모를 보는 보조 지표이며 안정성·보안·실행 비용의 증거로 사용하지 않았다. 버전은 조사 당시의 릴리스 확인값으로, 설치 시 상호 호환성을 검증하고 잠금 파일에 고정해야 한다.

## 추천 구성

| 영역 | 후보 | 이 서비스에 사용하는 이유 |
| --- | --- | --- |
| 프론트 기본 | React + TypeScript + [Vite](https://github.com/vitejs/vite) | 별도 렌더링 서버 없이 정적 SPA를 빌드해 Vercel에 배포한다. |
| 화면 이동 | [React Router](https://github.com/remix-run/react-router) | 직원 장비 목록·본인 이력·관리자 화면을 구분한다. Declarative 모드로 시작한다. |
| 서버 데이터 | [TanStack Query](https://github.com/TanStack/query) | 목록 조회, 로딩·오류 처리, 승인·반납 후 관련 목록 새로고침을 관리한다. |
| 입력 폼 | [React Hook Form](https://github.com/react-hook-form/react-hook-form) + [Zod](https://github.com/colinhacks/zod) + [resolvers](https://github.com/react-hook-form/resolvers) | 자산 등록과 반납 예정일·거절 사유 입력 오류를 표시한다. 서버도 별도로 검증한다. |
| UI | [shadcn/ui](https://github.com/shadcn-ui/ui) + [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | 버튼, 폼, 확인 대화상자, 상태 표시 등 필요한 컴포넌트 코드만 도입한다. |
| 아이콘 | [Lucide React](https://github.com/lucide-icons/lucide) | 장비·검색·반납 등 일관된 아이콘을 필요한 것만 가져온다. |
| 백엔드 HTTP | [chi](https://github.com/go-chi/chi) | 라우트 그룹과 권한 미들웨어를 추가하면서 현재 net/http 서버와 호환성을 유지한다. 핵심 라우터는 외부 의존성이 없다. |
| SQLite | [modernc.org/sqlite](https://github.com/modernc-org/sqlite) + Go database/sql | CGO 없는 빌드로 로컬·CI·Railway 간 빌드 구성을 단순화한다. |
| DB 변경 | [goose](https://github.com/pressly/goose) | SQL 마이그레이션 이력을 관리한다. SQLite 볼륨 마운트 후 앱 시작 시 실행한다. |
| Google 로그인 | [golang.org/x/oauth2](https://github.com/golang/oauth2) + [go-oidc](https://github.com/coreos/go-oidc) | Google 인증 흐름과 ID 토큰 검증을 담당한다. 등록 이메일·활성 계정·역할 검사는 서비스에서 수행한다. |
| 자동 검사 | [Vitest](https://github.com/vitest-dev/vitest) + [React Testing Library](https://github.com/testing-library/react-testing-library) + [Playwright](https://github.com/microsoft/playwright) | 입력 검증과 사용자 행동을 검사하고 신청→승인→반납 흐름을 브라우저에서 검증한다. |

Vite는 운영용 정적 파일을 빌드한다. React Router의 Declarative 모드는 기본 화면 이동에 집중할 수 있어 서버 데이터는 Query로 일원화하는 이 구성에 적합하다는 판단이다. [Vite 공식 설명](https://vite.dev/guide/), [Router 모드 비교](https://reactrouter.com/start/modes).

shadcn/ui는 필요한 컴포넌트 소스를 프로젝트로 가져오는 방식이다. 가져온 코드의 업데이트와 접근성 검증은 프로젝트 책임이다. [공식 설명](https://ui.shadcn.com/docs).

## 프론트엔드 대안과 보류 항목

- TanStack Form도 후보지만 이 서비스의 단순 등록·신청 폼에는 React Hook Form과 Zod 조합을 우선 추천한다. 두 폼 라이브러리를 함께 넣지 않는다. [RHF의 Zod 연동](https://github.com/react-hook-form/resolvers#zod), [TanStack Form](https://github.com/TanStack/form).
- [TanStack Table](https://github.com/TanStack/table)은 정렬·페이지 이동·열 제어가 복잡해질 때 도입한다. 첫 화면에서 간단한 목록만 필요하다면 기본 테이블로 충분하다.
- Axios 대신 브라우저 fetch를 사용하고 공통 오류·인증 처리를 작은 API 함수로 모은다. Redux·Zustand는 실제로 별도 전역 상태가 필요할 때 검토한다.
- Next.js·TanStack Start 등 서버 렌더링 구성을 요구하지 않는다. 현재 요구사항에는 Go API와 정적 SPA 구성을 우선 추천한다.
- Redis, 메시지 큐, WebSocket, 별도 검색 서버는 현재 업무 범위에서 도입하지 않는다.
- 날짜 입력은 기본 날짜 입력 UI를 우선 사용한다. KST 연체 판단은 서버가 수행하고 단순 날짜를 브라우저 현지 시간대로 재해석하지 않는다.

## 비용과 정확성을 위한 설정 제안

- Query는 기본적으로 캐시를 stale로 보고 창 포커스 등에 재조회하며 조회 실패를 재시도한다. 불필요한 요청을 줄이도록 staleTime을 정하고 상시 폴링은 끈다. 승인·반납 후 관련 쿼리를 무효화하고, 장비 사용 가능 여부는 서버 트랜잭션으로 재검사한다. 캐시가 최신이라는 가정으로 승인하지 않는다. [Query 기본 동작](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).
- 로그인 실패·권한 오류는 자동 재시도하지 않고 화면에 안내한다. 로그아웃·계정 전환 시 이전 사용자의 Query 캐시를 비운다.
- Vitest·Testing Library·Playwright는 개발·CI 의존성이다. 브라우저 테스트 실행 도구를 Go 운영 컨테이너에 설치하지 않는다. [Vitest](https://vitest.dev/guide/), [Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [Playwright](https://playwright.dev/docs/intro).
- Railway 볼륨 사용 시 복제본을 늘릴 수 없고 재배포 시 중단이 발생할 수 있다. SQLite 마이그레이션을 pre-deploy에서 실행하지 않는다. [볼륨 제약](https://docs.railway.com/volumes/reference), [pre-deploy](https://docs.railway.com/deployments/pre-deploy-command).
- Railway 볼륨 백업을 설정하고 실제 복원 테스트를 한다. 영구 볼륨만으로 백업을 대신하지 않는다. [공식 백업 안내](https://docs.railway.com/volumes/backups).
- 어떤 프레임워크가 몇 원을 절약한다는 수치는 측정하지 않았다. Go 서버 단일 서비스와 SQLite로 별도 DB 프로세스를 줄이는 구조이며 실제 요금은 배포 후 CPU·메모리·볼륨·전송량으로 확인한다.

## GitHub 유지보수 확인

아래 값은 조사일에 GitHub API의 repos/{owner}/{repo}와 releases/latest로 조회했다. 모두 archived=false였다. latest 릴리스는 저장소 단위로, 특정 npm 패키지의 설치 버전과 다를 수 있다.

| 저장소 | 별 수 | 최신 정식 릴리스 확인값 | 라이선스 확인 |
| --- | ---: | --- | --- |
| [Vite](https://github.com/vitejs/vite) | 83,424 | v8.3.5 | MIT |
| [React Router](https://github.com/remix-run/react-router) | 56,613 | react-router@8.5.0 | MIT |
| [TanStack Query](https://github.com/TanStack/query) | 50,452 | release-2026-10-19-1659 | MIT |
| [React Hook Form](https://github.com/react-hook-form/react-hook-form) | 44,873 | v7.90.0 | MIT |
| [Zod](https://github.com/colinhacks/zod) | 44,165 | v4.6.7 | MIT |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | 126,097 | shadcn@4.22.1 (CLI) | MIT |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | 97,947 | 이번 조사에서 조회하지 않음 | MIT |
| [Vitest](https://github.com/vitest-dev/vitest) | 17,268 | v5.0.5 | MIT |
| [Playwright](https://github.com/microsoft/playwright) | 98,196 | v1.64.1 | Apache-2.0 |

Lucide는 GitHub API의 SPDX 판정이 NOASSERTION이어서 [LICENSE 본문](https://github.com/lucide-icons/lucide/blob/main/LICENSE)을 확인했다. ISC 표기가 있으나 채택 시 파생 아이콘을 포함한 파일 전체의 고지를 유지한다. 각 패키지의 실제 채택 버전과 전이 의존성도 별도로 확인한다.

## バックエンド詳細

[Goフレームワーク・DB・認証の比較](backend-library-research.md)を参照。セッション永続化はSQLiteドライバとの互換性を確認してから採用し、Redisなど別サービスを必須にしない。
