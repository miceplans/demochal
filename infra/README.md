# infra/

AWS 배포/IaC 관련 파일을 위한 디렉토리. 현재는 비어 있음.

## 예정 구성

- ECS Fargate + ALB (API 서비스, 워커 서비스 — 같은 소스, 다른 CMD)
- RDS PostgreSQL Single-AZ (private subnet)
- NAT Gateway, RDS Multi-AZ는 초기 단계에서 제외 (필요해지면 도입)
- SQS (verifications 큐) + S3 (공개 콘텐츠 / 비공개 등록증 버킷 분리)

구성은 추후 Terraform 또는 콘솔로 예정.

## 별도 배포 대상 (server/ 코드베이스에 포함하지 않음)

- `lambda/verification-cleanup/` — 사업자등록증 만료 삭제 배치 (EventBridge 트리거, Lambda)

## 파일 업로드 보안 필수 설정

- private 버킷은 S3 Block Public Access를 켜고, API/워커 IAM 역할만 읽기·쓰기 권한을 갖게 한다.
- public 버킷에는 검증 완료된 JPEG, PNG, WebP만 API가 복사할 수 있게 하고, 클라이언트의 직접 쓰기 권한은 부여하지 않는다.
- public 콘텐츠는 CloudFront를 통해 제공하고 `X-Content-Type-Options: nosniff` 응답 헤더를 추가한다.
- 기존 public 객체는 `legacy_unverified` DB 상태와 대조해 즉시 검토·격리한다.
