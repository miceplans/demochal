# infra/

AWS 스테이징 IaC는 [`terraform/`](terraform/)에 있습니다. 이 구성은 `ap-northeast-2`의 비용 우선 Single-AZ 스테이징 전용입니다. ALB와 RDS subnet group의 AWS 제약 때문에 두 AZ에 subnet은 만들지만, ECS API/worker와 RDS primary는 첫 번째 AZ에만 둡니다.

> `semochal-staging-*`는 이미 배포된 리소스입니다. 기존 S3 backend state로 `terraform plan -var-file=staging.tfvars`를 먼저 검토하고, re-create 또는 destroy가 있으면 apply하지 않습니다. GitHub `staging` Environment는 `main`의 승인된 자동 배포가 이 staging ECS 리소스로 향하는 release gate다. Vercel은 이 저장소의 관리 대상이 아닙니다.

## production 스택 전환 (staging → production)

> 현재 실제 서비스(`www.semochall.com`)는 `semochal-staging-*` 스택에서 돌아간다. AWS 리소스는 이름을 바꿀 수 없어 같은 모듈로 `production` 스택을 새로 만들어 옮긴다. 코드는 `environment = "production"`을 지원하며, 아래 순서는 승인된 운영자가 별도 세션에서 수행한다. 각 apply 전에 `plan`을 확인하고 destroy/replace가 있으면 멈춘다.

1. **기준선 확인**: staging 상태에서 `tofu plan`이 상태 저장 리소스(RDS, S3, ALB)의 destroy/replace 없이 끝나는지 확인한다. OIDC 공급자는 `[0]` 주소로 `moved`만 표시된다.
2. **production 스택 생성**: `production.tfvars.example`을 복사해 값을 채우고 `tofu init -reconfigure -backend-config="key=production/terraform.tfstate"` 후 `enable_runtime=false`로 apply한다. 먼저 정리할 잔재: Route 53의 옛 `prod-server` A 레코드(삭제된 ALB를 가리킴), ACM의 `prod-server` 인증서, 옛 `semochal-production-*` 로그 그룹·CloudFront·경보.
3. **시크릿·이미지**: `semochal-production/app` 시크릿에 운영 값을 넣는다(Toss·KCP·네이버페이는 운영 키, `KCP_PRODUCTION=true`). `semochal-production-*` ECR에 `deploy-` 태그 이미지를 push하고 digest를 `api_image`·`worker_image`에 넣는다.
4. **데이터 이전**: staging 쓰기를 잠시 멈추고(점검 공지) RDS 스냅샷을 만든 뒤 `db_snapshot_identifier`로 production RDS를 복원한다(변수를 바꾸면 인스턴스가 교체되므로 `db_deletion_protection=false`와 `db_skip_final_snapshot=true`로 먼저 apply하고 복원 후 다시 켠다). 첫 생성 때 쓰면 교체 없이 바로 복원된다. S3는 비공개·공개 버킷을 `aws s3 sync`로 복사한다(사업자 서류는 비공개 버킷에서 비공개 버킷으로만 복사한다).
5. **마이그레이션·기동**: migrate 태스크를 실행하고 `enable_runtime=true`로 API·worker를 기동한 뒤 `/health`와 주요 흐름을 확인한다.
6. **전환(DNS 한 단계)**: API 주소는 `server.semochall.com`을 그대로 쓴다. 사전에 `api_alternate_domain_name = "server.semochall.com"`으로 apply해 production ALB에 이 이름의 인증서를 붙여 둔다(트래픽은 그대로 staging). 검증이 끝나면 (a) staging 스택에서 해당 레코드를 상태에서 뺀다(`tofu state rm aws_route53_record.api`) — 그러지 않으면 staging apply가 레코드를 되돌린다 — 그리고 (b) production에서 `api_alternate_domain_cutover = true`로 apply하면 `server.semochall.com`이 production ALB를 가리킨다. 롤백은 `api_alternate_domain_cutover=false` 후 staging 상태에서 레코드를 다시 import하거나, Route 53에서 레코드를 staging ALB로 직접 되돌린다. 주소가 그대로라 Vercel `API_PROXY_TARGET`·`NEXT_PUBLIC_API_URL`, OAuth 콜백, Toss 웹훅 URL은 바꿀 필요가 없다. 이미지 CDN 주소(`PUBLIC_ASSETS_BASE_URL`)만 production CloudFront 주소로 바꾼다. 결제는 `PAYMENTS_ENABLED`와 `NEXT_PUBLIC_PAYMENTS_ENABLED`를 `true`로 켜기 전까지 막혀 있다.
7. **공유 리소스 이전**: `tofu state pull`로 두 state를 백업한 뒤 로컬 파일 사이에서 `tofu state mv -state=<staging> -state-out=<production>`로 GitHub OIDC 공급자(`...github_actions` → `...github_actions[0]`), SES 도메인 identity·MAIL FROM·DKIM 3개·MX·SPF·DMARC 레코드를 옮기고 production → staging 순서로 `tofu state push`한다. 수신 규칙 세트는 이름에 스택 접두사가 들어가 이전하면 교체되므로 옮기지 않는다 — production이 `semochal-production-email-inbound`를 새로 만들어 활성화하게 하고(`manage_shared_resources=true`), staging state에서는 `aws_ses_active_receipt_rule_set.email_inbound[0]`를 `tofu state rm` 한다(남기면 staging 정리 때 production 수신까지 꺼진다). `server.semochall.com`의 ACM 검증 CNAME(`aws_route53_record.certificate["server.semochall.com"]`)도 staging state에서 `tofu state rm` 한다(production 인증서가 같은 레코드를 쓴다). DMARC 정책은 이때 `ses_dmarc_policy`로 올린다.
8. **staging 정리**: 일정 기간 롤백용으로 두었다가 최종 스냅샷을 남기고 staging 스택을 destroy한다.

이 PR은 코드(1~2번 준비)만 다룬다. CI의 production 배포 잡(`Production` GitHub Environment, 승인자 필요)은 production 스택이 생성되어 변수가 정해진 뒤 별도로 추가한다.

## 예정 구성

- ECS Fargate + ALB (API 서비스, 워커 서비스 — 같은 소스, 다른 CMD)
- RDS PostgreSQL Single-AZ (private subnet)
- NAT Gateway, RDS Multi-AZ는 초기 단계에서 제외 (필요해지면 도입)
- SQS (emails 큐, inbound emails 큐) + SES(서비스성 이메일) + S3 (공개 콘텐츠 / 비공개 등록증 버킷 분리)

## 적용 전 준비

Terraform은 리소스만 정의하며 `apply`·DNS 변경·provider 콘솔 등록을 자동 수행하지 않습니다. 실제 적용은 승인된 운영자가 별도 세션에서 수행합니다.

1. 암호화된 S3 state bucket과 DynamoDB lock table(`semochal-staging-tfstate`, `semochal-staging-tfstate-lock`)을 별도 bootstrap하고, 해당 backend에 접근할 IAM 권한을 부여합니다. 일반 apply는 `backend.tf`를 사용하며 local state로 진행하지 않습니다.
2. `staging.tfvars.example`을 복사해 실제 도메인과 hosted zone ID를 넣습니다. 이 파일에는 secret 값을 넣지 않습니다.
3. 첫 apply는 `enable_runtime=false`로 VPC/ECR/RDS/S3/SQS/IAM/ALB만 생성합니다. `api_image`/`worker_image`는 비워도 됩니다.
4. ECR repository URI로 API/worker immutable digest 이미지를 push합니다. 두 repository 모두 `IMMUTABLE` tag이며 ECR lifecycle policy가 태그 prefix로 보존 기간을 나눕니다 — 실제 배포용 이미지는 `deploy-`로 시작하는 태그(예: `deploy-2024-06-01-abcd123`)로 push해 최근 10개까지 보존하고, 일회성 테스트 이미지만 `test-`로 시작하는 태그를 써서 2개 초과분이 즉시 정리되도록 합니다. 두 prefix 어디에도 속하지 않는 태그는 lifecycle policy가 건드리지 않습니다(무기한 보존). `api_image`/`worker_image`에는 push 후 resolve한 `@sha256:...` digest를 넣습니다. RDS가 생성한 master secret에서 username/password를 승인된 운영자 세션에서 조회하고 RDS endpoint, port `5432`, database name과 함께 URL-encode한 `DATABASE_URL`을 application secret에 수동으로 저장합니다. application secret의 키는 `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`, `TOSS_SECRET_KEY`, `TOSS_WEBHOOK_ALLOWED_IPS`, `NAVERPAY_CLIENT_ID`, `NAVERPAY_CLIENT_SECRET`, `NAVERPAY_CHAIN_ID`, `KCP_SITE_CD`, `KCP_CERT_INFO`, `KCP_PRIVATE_KEY`, `KCP_PRIVATE_KEY_PASSWORD`, `KCP_MOBILE_RETURN_URL`, `NTS_API_KEY`입니다. RDS credential을 rotation하면 같은 세션에서 application secret의 `DATABASE_URL`을 갱신한 뒤 ECS API/worker에 force new deployment를 실행합니다. 값은 코드, tfvars, state, Issue/PR에 기록하지 않습니다.
5. RDS는 private subnet에만 있어 로컬에서 직접 접근할 수 없고 `/health`는 단순 `select 1`이라 스키마가 없어도 통과합니다. `enable_runtime=true`로 API/worker를 띄우기 전에 반드시 아래 one-off ECS task로 Drizzle 마이그레이션을 적용합니다(`server/src/migrate.ts` → `dist/migrate.js`, `pnpm --filter @semochal/server db:generate`로 생성된 `server/drizzle/*.sql`을 그대로 적용 — drizzle-kit CLI가 아니라 `drizzle-orm`의 programmatic migrator를 쓰므로 devDependency 없이 API 이미지 그대로 재사용합니다):

   ```sh
   aws ecs run-task \
     --cluster "$(terraform output -raw ecs_cluster_name)" \
     --task-definition "$(terraform output -raw migrate_task_definition_arn)" \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[$(terraform output -raw migrate_task_subnet_id)],securityGroups=[$(terraform output -raw migrate_task_security_group_id)],assignPublicIp=ENABLED}"
   ```

   CloudWatch Logs(`/ecs/semochal-staging/migrate`)에서 태스크가 `Migrations applied successfully.`를 남기고 exit code 0으로 종료했는지 확인합니다.

6. `enable_runtime=true`와 `api_image`를 설정해 API 한 개를 기동합니다. worker는 SQS 큐 2개(emails, inbound emails) 소비와 주기 스캔(챌린지 알림, refund_pending 재시도, KCP 승인 복구, 사업자 서류 보관 기한)을 담당하므로, 서비스가 도는 스택에서는 `worker_desired_count=1`로 상시 실행합니다. 변수 기본값 0은 큐·SES 준비 전 신규 환경을 올릴 때만 씁니다.
7. 출력된 `api_url`을 Google/Kakao/Naver OAuth callback 및 Toss webhook 등록에 사용합니다. 등록 자체는 provider 계정 소유자가 수행합니다.

### 필요할 때만 staging DB에 접속

`db-admin` task와 이 task 전용 NAT Gateway는 상시 과금을 피하려고 기본값으로 생성하지 않습니다(`enable_db_admin = false`). 접속이 필요할 때만 `terraform apply -var-file=staging.tfvars -var enable_db_admin=true`로 만들고, 작업을 마치면 task를 중지한 뒤 같은 명령을 `enable_db_admin=false`로 다시 apply해 NAT Gateway를 제거합니다.

`db-admin` task는 private subnet에서만 실행되고 public IP를 받지 않습니다. ECS Exec를 켜서 접속한 뒤 컨테이너 안의 `DATABASE_URL`을 그대로 `psql`에 전달합니다. 실제 secret 값은 출력하거나 명령행에 직접 넣지 않습니다.

```sh
DB_ADMIN_TASK_ARN="$(aws ecs run-task \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --task-definition "$(terraform output -raw db_admin_task_definition_arn)" \
  --launch-type FARGATE \
  --enable-execute-command \
  --network-configuration "awsvpcConfiguration={subnets=[$(terraform output -raw db_admin_subnet_id)],securityGroups=[$(terraform output -raw db_admin_security_group_id)],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)"

aws ecs wait tasks-running \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --tasks "$DB_ADMIN_TASK_ARN"

aws ecs execute-command \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --task "$DB_ADMIN_TASK_ARN" \
  --container db-admin \
  --interactive \
  --command "/bin/bash"

# ECS Exec shell 안에서 실행
psql "$DATABASE_URL"

# 사용 후 로컬 셸에서 task 종료
aws ecs stop-task \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --task "$DB_ADMIN_TASK_ARN" \
  --reason "manual db-admin session complete"
```

ECS Exec에는 AWS CLI Session Manager Plugin이 필요합니다. task가 종료되면 다시 실행해야 하며, 이 구성에는 `aws_ecs_service`가 없습니다. 이 task는 Terraform에 정의된 `postgres:16-bookworm` 이미지로 실행되며, TLS 검증이 필요한 DB 관리 절차에는 사용하지 않습니다.

### Grafana CloudWatch integration

Grafana Cloud에서 발급한 external ID는 저장소나 `tfvars`에 기록하지 않습니다. apply를 실행하는 승인된 운영자 세션에서 `TF_VAR_grafana_external_id` 환경변수로만 제공하고, apply 후 `terraform output -raw grafana_cloudwatch_role_arn`의 ARN을 Grafana Cloud CloudWatch integration에 등록합니다. external ID는 IAM trust policy의 일부이므로 Terraform state에는 포함될 수 있습니다. state backend와 state를 읽을 수 있는 IAM principal은 승인된 운영자로 제한합니다. Terraform은 Grafana Labs AWS account에만 이 역할을 assume하도록 제한하며, trust policy의 external ID 조건도 함께 검증합니다.

ECS task는 NAT Gateway 비용을 피하기 위해 public subnet에서 public IP를 사용합니다. API의 인바운드는 ALB security group만 허용하며 worker와 migrate task에는 인바운드가 없습니다. RDS는 private subnet 및 ECS task(API/worker/migrate) security group에서만 접근됩니다. 비용 최소화를 위해 API task 1개(0.25 vCPU/0.5 GB), worker 1개(큐 소비·주기 스캔용 상시 최소치), RDS `db.t4g.micro` 20 GiB·1일 백업, CloudWatch 7일 보존입니다. ECR은 `test-` 태그 이미지 2개, `deploy-` 태그 이미지 10개를 보존합니다(4단계 참고).

### 서비스성 이메일 (SES)

알림 이메일 워커(`SQS_EMAILS_QUEUE_URL` → SES `SendEmail`)용 발신 identity는 `ses.tf`가 관리합니다. identity 생성(`ses_domain`)과 발송 활성화(`ses_from_email`)는 분리돼 있습니다. 샌드박스 계정에서 발송을 켜면 검증되지 않은 수신자 메일이 전부 실패해 emails DLQ로 쌓이기 때문입니다.

1. tfvars에 `ses_domain = "semochall.com"`을 넣고 apply합니다. SES 도메인 identity(Easy DKIM, RSA 2048)와 `hosted_zone_id` zone의 레코드(DKIM CNAME 3개, `mail.<domain>` MX·SPF, `_dmarc` TXT `p=none`)가 생성됩니다. `ses_domain`은 해당 zone 안의 도메인이어야 합니다.
2. DKIM 검증 완료를 확인합니다(보통 수 분~72시간): `aws sesv2 get-email-identity --email-identity semochall.com --query '{dkim:DkimAttributes.Status,mailFrom:MailFromAttributes.MailFromDomainStatus}'`가 `SUCCESS`여야 합니다.
3. SES production access를 요청합니다. Terraform 리소스가 없어 계정 소유자가 콘솔(SES → Account dashboard → Request production access)에서 진행합니다. 서비스성 알림만 보내고 bounce/complaint는 계정 단위 suppression list(`BOUNCE`, `COMPLAINT`)로 처리한다고 적습니다. https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
4. 승인 후 `ses_from_email = "noreply@semochall.com"`, `ses_support_from_email = "help@semochall.com"`을 넣고 apply합니다. 워커 task role은 이 identity와 두 From 주소로 제한된 `ses:SendEmail`을 가지며, `SES_FROM_EMAIL`은 자동 메일용 `noreply@`, `SES_SUPPORT_FROM_EMAIL`은 고객지원용 `help@`로 주입됩니다. ECS 서비스는 `task_definition`을 무시하므로 다음 `main` 배포(또는 승인된 수동 배포)가 새 revision을 사용합니다.

### 고객지원 수신 메일

`help@semochall.com`은 `email_inbound.tf`가 관리하는 SES Receipt Rule의 유일한 recipient입니다. SES는 원본 MIME을 `${local.name_prefix}-email-inbox-*` private S3 bucket의 `inbound/` prefix에 저장한 뒤 processor Lambda를 비동기로 호출합니다. `noreply@semochall.com`은 receipt rule에 포함하지 않습니다. apex MX가 이미 `inbound-smtp.ap-northeast-2.amazonaws.com`을 가리키는 경우 Terraform은 해당 MX를 다시 관리하거나 교체하지 않습니다.

DMARC는 `p=none`으로 시작합니다. 전달 상태를 확인한 뒤 `ses_dmarc_policy`를 `quarantine`/`reject`로 올립니다.

## 레이트리밋 저장소

staging은 API 태스크가 1개라 별도 Redis 없이 서버의 인메모리 `@nestjs/throttler` 저장소를 씁니다(`REDIS_URL` 미주입).
API 태스크를 2개 이상으로 늘리면 IP당 한도가 태스크 수만큼 늘어나므로(issue #569), 그 전에 공유 저장소(ElastiCache Redis 등)를 추가하고 API task definition에 `REDIS_URL`을 주입합니다.

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
   승인된 staging 배포는 서비스 갱신 전에 새 이미지의 migrate task를 실행하고 exit code 0을
   확인합니다.

인증서 검증 오류가 발생하면 CA bundle의 AWS 원본과 image digest/task definition 일치를
확인합니다. `--no-verify`, `rejectUnauthorized: false`, 또는
`NODE_TLS_REJECT_UNAUTHORIZED=0`으로 우회하지 않습니다.

## DB 관리 task

Terraform은 `postgres:16-bookworm` 기반의 on-demand `db_admin` task definition만 관리한다. custom db-admin Dockerfile과 이미지는 이 저장소에 포함하지 않는다. 따라서 이 task를 TLS 검증이 필요한 운영 접근 경로로 사용하지 않으며, 그런 접근이 필요하면 CA bundle과 `PGSSLMODE=verify-full`을 포함하는 별도 이미지·검증 절차를 별도 작업으로 추가한다.

## 사업자 서류 보관 기한

사업자등록증 등 인증 서류는 별도 Lambda 없이 아래 두 장치로 보관 기한을 지킨다.

- **워커 보관 기한 스캔**(`VerificationDocumentRetentionService`, 1시간 주기): 인증이 결정(verified/rejected)된 지 `business_document_retention_days`(기본 30일)가 지났거나, 결정과 무관하게 제출된 지 `business_document_max_retention_days`(기본 90일)가 지난 서류를 private 버킷에서 지운다. files 행은 `deleted`, `verifications.ocr_result`는 null이 된다. 태그 도입 전에 저장된 서류도 이 스캔이 지운다.
- **private 버킷 S3 수명주기 규칙**(`aws_s3_bucket_lifecycle_configuration.private`): API가 제출 시 서류 객체에 `data-class=business-document` 태그를 달고, 이 태그가 달린 객체는 업로드 후 `business_document_max_retention_days`가 지나면 S3가 만료시킨다. 워커가 멈춰도 상한은 지켜진다. 미완료 멀티파트 업로드는 1일 뒤 정리한다.
- 인증 제출 없이 버려진 업로드는 사업자 서류인지 구분할 수 없어 대상이 아니다(코드 TODO).

## 워커 동작

워커는 큐마다(emails/inbound-emails) 독립된 롱폴링 루프를 돌린다. outbox 릴레이(2초 주기)와 주기 스캔(챌린지 알림·환불 재시도·KCP 승인 복구·서류 보관 기한)도 각자 별도 루프에서 실행해, 빈 큐의 20초 대기가 다른 큐나 스캔을 늦추지 않는다. 처리 중인 메시지는 30초마다 `ChangeMessageVisibility`로 가시성 타임아웃(120초)을 연장해 배치 처리가 길어져도 중복 처리되지 않게 한다. 핸들러가 멈췄을 때 메시지가 영원히 묶이지 않도록 연장은 최대 15분까지만 한다.

## 파일 업로드 보안 필수 설정

- private 버킷은 S3 Block Public Access를 켜고, API/워커 IAM 역할만 읽기·쓰기 권한을 갖게 한다.
- public 버킷에는 검증 완료된 JPEG, PNG, WebP만 API가 복사할 수 있게 하고, 클라이언트의 직접 쓰기 권한은 부여하지 않는다.
- public 콘텐츠는 CloudFront를 통해 제공하고 `X-Content-Type-Options: nosniff` 응답 헤더를 추가한다.
- CloudFront 도메인은 `PUBLIC_ASSETS_BASE_URL` 환경변수로 API/worker에 전달되어, ready 상태 public 파일/광고 이미지 응답의 `url`/`imageUrl` 필드를 완전한 URL로 채운다(`files.service.ts`/`ads.service.ts`). private 파일은 이 필드가 항상 null이며 presigned GET로만 접근한다.
- 기존 public 객체는 `legacy_unverified` DB 상태와 대조해 즉시 검토·격리한다.
