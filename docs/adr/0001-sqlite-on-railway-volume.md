# Railway 영구 볼륨의 SQLite를 사용한다

사내 소규모 사용과 낮은 동시 쓰기 빈도, 운영 비용 절감을 우선하여 별도 DB 서버 대신 Go 백엔드에 SQLite를 함께 두고 Railway 영구 볼륨에 저장하기로 했다. 백엔드는 단일 인스턴스로 운영하며 재배포 시 짧은 중단을 수용하는 구성이므로 운영 전 백업·복구를 검증하고, 다중 인스턴스나 지속적인 동시 쓰기가 필요해지면 별도 DB 서버로 이전을 재검토한다.

Railway 볼륨은 replicas와 함께 사용할 수 없고 pre-deploy 단계에 마운트되지 않으므로, DB 마이그레이션은 볼륨이 연결된 시작 단계에서 요청 수신 전에 실행한다. [볼륨 제약](https://docs.railway.com/volumes/reference), [pre-deploy 제약](https://docs.railway.com/deployments/pre-deploy-command).
