# 세모챌 서버 (NestJS)

## 디렉터리 구조

```
server/
├─ src/
│  ├─ main.ts / worker.ts / migrate.ts   # 진입점(API · SQS 워커 · 마이그레이션). dist 루트에 그대로 빌드됨
│  ├─ app/                               # 앱 조립: app.module, worker.module, app.factory, app.configure
│  ├─ infra/                             # 인프라 계층
│  │  ├─ config/                         #   env(zod) 검증
│  │  ├─ db/                             #   Drizzle provider, schema(core/features), pool 옵션
│  │  ├─ queue/                          #   SQS 클라이언트
│  │  └─ outbox/                         #   Outbox 서비스 / relay
│  ├─ common/                            # 도메인 무관 공용 코드: health, http, maintenance, security, throttling
│  └─ modules/<기능>/                    # 기능별 모듈 (controller · service · module · dto/ + 역할별 하위 폴더)
│     └─ guards/ decorators/ utils/ clients/ settings/ alerts/ scan/ email/ …
├─ drizzle/        # 마이그레이션 SQL (drizzle-kit 생성, CI 배포가 적용)
├─ docs/           # openapi.yaml 등
├─ api/            # Vercel 서버리스 진입점 (데모용)
└─ certs/          # RDS CA 번들
```

규칙: 한 기능의 코드는 `modules/<기능>/` 안에서 끝낸다. 가드·데코레이터·순수 함수·외부 클라이언트는
각각 `guards/`, `decorators/`, `utils/`, `clients/`로 모으고, spec은 대상 파일 옆에 둔다.

## Run with Docker (local)

저장소 루트에서 API와 로컬 PostgreSQL을 한 번에 기동합니다.

```bash
$ docker compose up -d --build
$ curl http://localhost:3001/health # {"status":"ok",...}
```

- `db`(postgres:16)가 healthy해진 뒤 `migrate`가 `node dist/migrate.js`로 대기 중인 마이그레이션을 Drizzle의 마이그레이션 저널에 기록하며 적용하고, 성공적으로 끝나면 `api`가 기동합니다. `api` 컨테이너는 `/health` 기반 healthcheck를 가집니다.
- `migrate`는 기존 ECS 마이그레이션 태스크와 동일한 진입점을 재사용하므로, 볼륨을 유지한 채로 새 마이그레이션을 추가해도(`server/drizzle`에 파일 추가 후 `docker compose up`) 정상적으로 증분 적용됩니다 — `down -v`로 데이터를 지울 필요가 없습니다.
- `db`는 `127.0.0.1`에만 포트를 게시하므로 같은 네트워크의 다른 호스트에서는 접근할 수 없습니다.
- 로컬 compose 실행은 `NODE_ENV=development`로 오버라이드하므로 secret 주입 없이 기동할 수 있습니다.
- 종료: `docker compose down`(DB 데이터 유지) / `docker compose down -v`(DB 데이터 삭제)

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# File-upload security rollout

`0000_file_upload_hardening.sql` adds the verification state required by the
private-upload/finalize flow. Apply it before deploying the API change.

Existing public S3 objects predate byte validation. Inventory and quarantine
them with the bucket/CloudFront configuration before treating them as trusted.
