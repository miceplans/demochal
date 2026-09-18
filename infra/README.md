# infra/

AWS 스테이징 IaC는 [`terraform/`](terraform/)에 있습니다. 이 구성은 `ap-northeast-2`의 비용 우선 Single-AZ 스테이징 전용입니다. ALB와 RDS subnet group의 AWS 제약 때문에 두 AZ에 subnet은 만들지만, ECS API/worker와 RDS primary는 첫 번째 AZ에만 둡니다.

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
4. ECR repository URI로 API/worker immutable digest 이미지를 push하고, `app_secret_arn`에 JSON secret을 수동으로 저장합니다. 키는 `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOSS_SECRET_KEY`, `CLOVA_OCR_API_URL`, `CLOVA_OCR_SECRET_KEY`, `NTS_API_KEY`입니다. 값은 코드, tfvars, state, Issue/PR에 기록하지 않습니다.
5. `enable_runtime=true`와 `api_image`를 설정해 API 한 개를 기동합니다. worker는 기본 0개이며 큐 테스트 때만 `worker_desired_count=1`로 켭니다.
6. 출력된 `api_url`을 Google/Kakao/Naver OAuth callback 및 Toss webhook 등록에 사용합니다. 등록 자체는 provider 계정 소유자가 수행합니다.

ECS task는 NAT Gateway 비용을 피하기 위해 public subnet에서 public IP를 사용합니다. API의 인바운드는 ALB security group만 허용하며 worker에는 인바운드가 없습니다. RDS는 private subnet 및 ECS task security group에서만 접근됩니다. 비용 최소화를 위해 기본값은 API task 1개(0.25 vCPU/0.5 GB), worker 0개, RDS `db.t4g.micro` 20 GiB·1일 백업, ECR image 2개 보존, CloudWatch 7일 보존입니다.

## 별도 배포 대상 (server/ 코드베이스에 포함하지 않음)

- `lambda/verification-cleanup/` — 사업자등록증 만료 삭제 배치 (EventBridge 트리거, Lambda)

## 파일 업로드 보안 필수 설정

- private 버킷은 S3 Block Public Access를 켜고, API/워커 IAM 역할만 읽기·쓰기 권한을 갖게 한다.
- public 버킷에는 검증 완료된 JPEG, PNG, WebP만 API가 복사할 수 있게 하고, 클라이언트의 직접 쓰기 권한은 부여하지 않는다.
- public 콘텐츠는 CloudFront를 통해 제공하고 `X-Content-Type-Options: nosniff` 응답 헤더를 추가한다.
- 기존 public 객체는 `legacy_unverified` DB 상태와 대조해 즉시 검토·격리한다.
