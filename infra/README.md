# infra/

AWS 스테이징 IaC는 [`terraform/`](terraform/)에 있습니다. 이 구성은 `ap-northeast-2`의 비용 우선 Single-AZ 스테이징 전용입니다. ALB와 RDS subnet group의 AWS 제약 때문에 두 AZ에 subnet은 만들지만, ECS API/worker와 RDS primary는 첫 번째 AZ에만 둡니다.

> 현재 `semochal-staging-*`는 기존 `server.semochall.com`이 사용하는 리소스이며, 이번 전환에서 실서비스로 승격됩니다. Secret 입력, 첫 배포, health check, migration, rollback 확인 전에는 기존 state나 AWS 리소스를 삭제·재생성하지 않습니다. 승격 후에는 이 리소스를 유일한 운영 환경으로 유지합니다.

## 예정 구성

- ECS Fargate + ALB (API 서비스, 워커 서비스 — 같은 소스, 다른 CMD)
- RDS PostgreSQL Single-AZ (private subnet)
- NAT Gateway, RDS Multi-AZ는 초기 단계에서 제외 (필요해지면 도입)
- SQS (verifications 큐) + S3 (공개 콘텐츠 / 비공개 등록증 버킷 분리)

## 적용 전 준비

Terraform은 리소스만 정의하며 `apply`·DNS 변경·provider 콘솔 등록을 자동 수행하지 않습니다. 실제 적용은 승인된 운영자가 별도 세션에서 수행합니다.

1. 암호화된 S3 state bucket과 DynamoDB lock table(`semochal-staging-tfstate`, `semochal-staging-tfstate-lock`)을 별도 bootstrap하고, 해당 backend에 접근할 IAM 권한을 부여합니다. 일반 apply는 `backend.tf`를 사용하며 local state로 진행하지 않습니다.
2. `staging.tfvars.example`을 복사해 실제 도메인과 hosted zone ID를 넣습니다. 이 파일에는 secret 값을 넣지 않습니다.
3. 첫 apply는 `enable_runtime=false`로 VPC/ECR/RDS/S3/SQS/IAM/ALB만 생성합니다. `api_image`/`worker_image`는 비워도 됩니다.
4. ECR repository URI로 API/worker immutable digest 이미지를 push합니다. 두 repository 모두 `IMMUTABLE` tag이며 ECR lifecycle policy가 태그 prefix로 보존 기간을 나눕니다 — 실제 배포용 이미지는 `deploy-`로 시작하는 태그(예: `deploy-2024-06-01-abcd123`)로 push해 최근 10개까지 보존하고, 일회성 테스트 이미지만 `test-`로 시작하는 태그를 써서 2개 초과분이 즉시 정리되도록 합니다. 두 prefix 어디에도 속하지 않는 태그는 lifecycle policy가 건드리지 않습니다(무기한 보존). `api_image`/`worker_image`에는 push 후 resolve한 `@sha256:...` digest를 넣습니다. RDS가 생성한 master secret에서 username/password를 승인된 운영자 세션에서 조회하고 RDS endpoint, port `5432`, database name과 함께 URL-encode한 `DATABASE_URL`을 application secret에 수동으로 저장합니다. application secret의 키는 `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI`, `TOSS_SECRET_KEY`, `CLOVA_OCR_API_URL`, `CLOVA_OCR_SECRET_KEY`, `NTS_API_KEY`입니다. RDS credential을 rotation하면 같은 세션에서 application secret의 `DATABASE_URL`을 갱신한 뒤 ECS API/worker에 force new deployment를 실행합니다. 값은 코드, tfvars, state, Issue/PR에 기록하지 않습니다.
5. RDS는 private subnet에만 있어 로컬에서 직접 접근할 수 없고 `/health`는 단순 `select 1`이라 스키마가 없어도 통과합니다. `enable_runtime=true`로 API/worker를 띄우기 전에 반드시 아래 one-off ECS task로 Drizzle 마이그레이션을 적용합니다(`server/src/migrate.ts` → `dist/migrate.js`, `pnpm --filter @semochal/server db:generate`로 생성된 `server/drizzle/*.sql`을 그대로 적용 — drizzle-kit CLI가 아니라 `drizzle-orm`의 programmatic migrator를 쓰므로 devDependency 없이 API 이미지 그대로 재사용합니다):

   ```sh
   aws ecs run-task \
     --cluster "$(terraform output -raw ecs_cluster_name)" \
     --task-definition "$(terraform output -raw migrate_task_definition_arn)" \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[$(terraform output -raw migrate_task_subnet_id)],securityGroups=[$(terraform output -raw migrate_task_security_group_id)],assignPublicIp=ENABLED}"
   ```

   CloudWatch Logs(`/ecs/semochal-staging/migrate`)에서 태스크가 `Migrations applied successfully.`를 남기고 exit code 0으로 종료했는지 확인합니다. 이 수동 실행은 최초 bootstrap용입니다. 이후 스키마 변경(새 `server/drizzle/*.sql`)은 `main` 배포 시 CI가 `production` 승인 후 같은 migrate task를 서비스 갱신 전에 자동 실행합니다([Production ECS release automation](#production-ecs-release-automation)).

6. `enable_runtime=true`와 `api_image`를 설정해 API 한 개를 기동합니다. worker는 기본 0개이며 큐 테스트 때만 `worker_desired_count=1`로 켭니다.
7. 출력된 `api_url`을 Google/Kakao/Naver OAuth callback 및 Toss webhook 등록에 사용합니다. 등록 자체는 provider 계정 소유자가 수행합니다.

### Grafana CloudWatch integration

Grafana Cloud에서 발급한 external ID는 저장소나 `tfvars`에 기록하지 않습니다. apply를 실행하는 승인된 운영자 세션에서 `TF_VAR_grafana_external_id` 환경변수로만 제공하고, apply 후 `terraform output -raw grafana_cloudwatch_role_arn`의 ARN을 Grafana Cloud CloudWatch integration에 등록합니다. external ID는 IAM trust policy의 일부이므로 Terraform state에는 포함될 수 있습니다. state backend와 state를 읽을 수 있는 IAM principal은 승인된 운영자로 제한합니다. Terraform은 Grafana Labs AWS account에만 이 역할을 assume하도록 제한하며, trust policy의 external ID 조건도 함께 검증합니다.

ECS task는 NAT Gateway 비용을 피하기 위해 public subnet에서 public IP를 사용합니다. API의 인바운드는 ALB security group만 허용하며 worker와 migrate task에는 인바운드가 없습니다. RDS는 private subnet 및 ECS task(API/worker/migrate) security group에서만 접근됩니다. 비용 최소화를 위해 기본값은 API task 1개(0.25 vCPU/0.5 GB), worker 0개, RDS `db.t4g.micro` 20 GiB·1일 백업, CloudWatch 7일 보존입니다. ECR은 `test-` 태그 이미지 2개, `deploy-` 태그 이미지 10개를 보존합니다(4단계 참고).

## RDS TLS 서버 인증서 검증

ECS의 API, worker, 그리고 one-off migrate 태스크는 이미지 안의 AWS RDS commercial-region
CA bundle(`/app/certs/global-bundle.pem`)을 `pg`의 `ssl.ca`로 사용하고
`rejectUnauthorized: true`로 서버 인증서 체인과 RDS endpoint hostname을 검증합니다.
TLS 정책은 URL이 아니라 애플리케이션 코드와 이미지에 있습니다.

새 이미지를 배포할 때 승인된 운영자는 다음 순서로 진행합니다. credential이나
`DATABASE_URL`의 실제 값은 로그, Issue, PR, Terraform 변수에 기록하지 않습니다.

1. monorepo root에서 API와 worker 이미지를 새 immutable `deploy-` 태그로 build/push하고,
   ECR digest를 확인합니다.
2. application secret의 `DATABASE_URL`에서 `sslmode`, `sslrootcert` 등 `ssl`로 시작하는
   query parameter를 제거합니다. endpoint hostname, port, database name과 인증 정보는
   그대로 유지합니다.
3. API, worker, migrate task definition이 새 digest를 사용하도록 승인된 배포 절차로
   갱신합니다. bundle은 image runtime에 포함되므로 별도 CA secret이나
   `NODE_TLS_REJECT_UNAUTHORIZED` 설정은 사용하지 않습니다.
4. API service와 필요 시 worker를 배포하고, API `/health`와 CloudWatch 로그를 확인합니다.
   마이그레이션은 CI 배포가 서비스 갱신 전에 migrate task로 적용하고 exit code 0을
   확인합니다. CI를 거치지 않는 수동 배포라면 새 이미지의 migrate task를 먼저 실행합니다.

인증서 검증 오류가 발생하면 CA bundle의 AWS 원본과 image digest/task definition 일치를
확인합니다. `--no-verify`, `rejectUnauthorized: false`, 또는
`NODE_TLS_REJECT_UNAUTHORIZED=0`으로 우회하지 않습니다.

## 별도 배포 대상 (server/ 코드베이스에 포함하지 않음)

- `lambda/verification-cleanup/` — 사업자등록증 만료 삭제 배치 (EventBridge 트리거, Lambda)

## Production ECS release automation

The existing [`terraform/`](terraform/) root and its current `semochal-staging-*` resources are promoted to serve the live workload. No second Production VPC/ECS/ECR/ALB stack is created. The existing staging backend/state remains the source of truth during this cutover; the AWS resource names remain unchanged.

Do not delete or recreate the existing resources while `server.semochall.com` still points at them. Keep application secret values out of tfvars, GitHub variables, issues, and logs.

```sh
cd infra/terraform
terraform init
terraform plan -var-file=staging.tfvars
# Approved operator only:
terraform apply -var-file=staging.tfvars
```

The first approved deployment uses the existing API and worker services. Before it, an approved operator must populate the existing application Secret. The first approved GitHub deployment registers digest-pinned revisions, runs the migration task, and sets the desired counts configured in the GitHub Environment variables.

### Terraform and CI ownership boundary

Terraform owns VPC/ECS/ECR/IAM/ALB/Secrets Manager resources and the task-definition structure (normal `environment` entries and `secrets` mappings). The production ECS services intentionally ignore only `task_definition` and `desired_count`: GitHub Actions owns their release revision and running scale. Consequently, a later Terraform apply cannot roll an approved CI deployment back to an earlier revision. Adding a normal ENV, secret key mapping, port, role, networking, or other task-definition structural setting remains a Terraform change; changing a Secret Manager value alone needs no Terraform apply.

Both production services enable the ECS deployment circuit breaker with rollback. If a newly registered revision cannot reach steady state, ECS rolls the service back to the last completed deployment.

### GitHub Environment setup

Create the GitHub Environment named `production` and require reviewers before deployment. Configure its deployment branch policy to allow **only `main`**. The IAM OIDC trust restricts the repository subject to `miceplans/demochal` and this Environment; GitHub's standard environment OIDC subject does not additionally carry the ref, so the Environment branch rule is the required `main` restriction.

After the initial Terraform apply, set these **Environment variables** (not secrets) from the corresponding Terraform outputs. They contain identifiers, never application credentials:

| GitHub Environment variable            | Terraform output                 |
| -------------------------------------- | -------------------------------- |
| `PRODUCTION_AWS_DEPLOY_ROLE_ARN`       | `github_actions_deploy_role_arn` |
| `PRODUCTION_ECS_CLUSTER`               | `ecs_cluster_name`               |
| `PRODUCTION_API_SERVICE`               | `api_service_name`               |
| `PRODUCTION_WORKER_SERVICE`            | `worker_service_name`            |
| `PRODUCTION_API_ECR_REPOSITORY`        | `api_ecr_repository_name`        |
| `PRODUCTION_WORKER_ECR_REPOSITORY`     | `worker_ecr_repository_name`     |
| `PRODUCTION_API_TASK_DEFINITION`       | `api_task_definition_family`     |
| `PRODUCTION_WORKER_TASK_DEFINITION`    | `worker_task_definition_family`  |
| `PRODUCTION_MIGRATE_TASK_DEFINITION`   | `migrate_task_definition_family` |
| `PRODUCTION_MIGRATE_SUBNET_ID`         | `migrate_task_subnet_id`         |
| `PRODUCTION_MIGRATE_SECURITY_GROUP_ID` | `migrate_task_security_group_id` |

Also set `PRODUCTION_API_DESIRED_COUNT` and `PRODUCTION_WORKER_DESIRED_COUNT` to the approved production scale. A main push first completes the existing verify job, then pauses for `production` Environment approval. Once approved, it builds API and worker images, pushes immutable `deploy-<commit-sha>` tags, resolves ECR digests, registers API/worker/migrate revisions from the Terraform templates, runs the migration task, updates the two services, and waits for stability. Database migration runs only inside this approved deployment job.

### Secret value refresh

The existing Terraform root uses Secrets Manager's native EventBridge `Secret Label Updated` event rather than CloudTrail request fields. The rule is scoped to the existing application secret and `AWSCURRENT`. `PutSecretValue` and a value-bearing `UpdateSecret` both move `AWSCURRENT` to a new version, while metadata-only `UpdateSecret` calls do not. The Lambda has only `ecs:UpdateService` for the existing API and worker services and CloudWatch Logs write access. It has no Secrets Manager permission and neither reads nor logs secret values.

After apply, test `PutSecretValue` and a value-bearing `UpdateSecret` with the approved production-secret rotation procedure and inspect the native EventBridge event shape without recording a value. Verify that exactly the production API and worker deployment IDs change, and that a metadata-only update does not restart either service. Also deploy an intentionally unhealthy disposable revision in the approved test window: ECS must roll back, and the workflow must fail because its requested revision is not primary. Do not include request payloads or secret values in tickets or logs.

### One-time staging-to-production cutover

Perform this sequence only after the Production first deployment is healthy:

1. Populate the Production application Secret and run the first approved `main` deployment. Confirm migration exit code 0, API/worker service stability, ALB health, application health, and rollback behavior.
2. Update the existing `server.semochall.com` DNS/route configuration to the Production ALB. Do not introduce or retain a `prod-server.semochall.com` endpoint; it is not part of the final architecture.
3. Confirm the real hostname, OAuth callbacks, webhooks, application traffic, logs, and secret-refresh redeployment against Production. Keep staging intact during the observation window.
4. After the cutover is accepted, keep these promoted resources as the single live environment. Do not run a staging destroy: these are the live Production resources despite their legacy `staging` names.

## 파일 업로드 보안 필수 설정

- private 버킷은 S3 Block Public Access를 켜고, API/워커 IAM 역할만 읽기·쓰기 권한을 갖게 한다.
- public 버킷에는 검증 완료된 JPEG, PNG, WebP만 API가 복사할 수 있게 하고, 클라이언트의 직접 쓰기 권한은 부여하지 않는다.
- public 콘텐츠는 CloudFront를 통해 제공하고 `X-Content-Type-Options: nosniff` 응답 헤더를 추가한다.
- CloudFront 도메인은 `PUBLIC_ASSETS_BASE_URL` 환경변수로 API/worker에 전달되어, ready 상태 public 파일/광고 이미지 응답의 `url`/`imageUrl` 필드를 완전한 URL로 채운다(`files.service.ts`/`ads.service.ts`). private 파일은 이 필드가 항상 null이며 presigned GET로만 접근한다.
- 기존 public 객체는 `legacy_unverified` DB 상태와 대조해 즉시 검토·격리한다.
