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
