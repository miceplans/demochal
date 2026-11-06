# semochall

## 로컬 개발

인프라 의존성(DB, S3 목업)은 docker compose로 띄운다.

```bash
docker compose up -d
```

- **DB**: `postgres://semochal:semochal@localhost:5432/semochal` — `migrate` 서비스가 마이그레이션을 적용한다.
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
