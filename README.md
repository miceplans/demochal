# semochall

## 로컬 개발

인프라 의존성(DB, S3 목업)은 docker compose로 띄운다.

```bash
docker compose up -d
```

- **DB**: `postgres://semochal:semochal@localhost:5432/semochal` — `migrate` 서비스가 마이그레이션을 적용한다.
- **S3 목업**: `localstack` + `s3-init` 서비스가 `semochal-public-dev` / `semochal-private-dev` 버킷과 브라우저 업로드용 CORS를 생성한다 (엔드포인트 `http://localhost:4566`).

서버(호스트에서 `pnpm --filter @semochal/server dev`)의 `server/.env`에 `S3_ENDPOINT=http://localhost:4566`을 설정하면 `POST /files/presign`의 업로드 URL이 LocalStack을 가리킨다. 비우거나 생략하면 기본 AWS S3를 사용한다.
