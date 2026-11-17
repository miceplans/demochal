# semochall

## 로컬 개발

가장 빠른 방법 — 워크트리마다 독립된 DB를 띄우고 마이그레이션까지 적용한 뒤 front/server를 실행한다.

```bash
pnpm dev:local            # DB 기동 + 마이그레이션 + pnpm dev
pnpm dev:local --reset    # 이 워크트리 DB를 비우고 처음부터 마이그레이션
pnpm dev:local --db-only  # DB + 마이그레이션까지만 (테스트용, DATABASE_URL 출력)
pnpm dev:local:down       # 이 워크트리 컨테이너 정리 (볼륨 유지)
```

- compose 프로젝트명은 워크트리 폴더명, DB 포트는 경로 해시로 정한 55000~55999 중 하나라 워크트리끼리 DB가 섞이지 않는다.
- `server/.env`·`front/.env.local`이 없으면 메인 체크아웃에서 복사한다. 실행 시 `DATABASE_URL`만 해당 DB로 덮어쓴다.
- front/server 포트(3000/3001)는 고정이므로 dev 서버는 한 워크트리에서만 동시에 띄울 수 있다.

수동으로 띄우려면:

인프라 의존성(DB, S3 목업)은 docker compose로 띄운다.

```bash
docker compose up -d
```

- **DB**: `postgres://semochal:semochal@localhost:5432/semochal` — `migrate` 서비스(또는 `pnpm dev:local`)가 마이그레이션을 적용한다.
- **S3 목업**: `localstack` + `s3-init` 서비스가 `semochal-public-dev` / `semochal-private-dev` 버킷과 브라우저 업로드용 CORS를 생성한다 (엔드포인트 `http://localhost:4566`).

서버(호스트에서 `pnpm --filter @semochal/server dev`)의 `server/.env`에 `S3_ENDPOINT=http://localhost:4566`을 설정하면 `POST /files/presign`의 업로드 URL이 LocalStack을 가리킨다. 비우거나 생략하면 기본 AWS S3를 사용한다.

## GitHub 계정과 Git 작성자 전환

처음 한 번 아래 명령으로 Git 별칭을 설치한다.

```bash
scripts/git-account-switch.sh install
```

그 뒤에는 `git aitubswitch`를 실행해 계정을 선택하거나, 계정을 인자로 지정할 수 있다.

```bash
git aitubswitch
git aitubswitch miceplanscom-lab
git aitubswitch hjy080530
```

이 명령은 GitHub CLI의 활성 계정을 확인한 뒤, 성공했을 때만 전역 Git `user.name`과 `user.email`을 같은 계정의 값으로 설정한다. GitHub CLI 인증 또는 전환에 실패하면 기존 Git 작성자 정보는 변경하지 않는다. Git 작성자 갱신에 실패하면 GitHub CLI 계정을 기존 계정으로 되돌리고 기존 Git 작성자 정보 복구를 시도한다.
