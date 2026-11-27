# Vercel 경유 API 클라이언트 IP

브라우저의 `/api` 요청은 Vercel rewrite를 거쳐 ALB와 Nest API에 도달한다. API는 ALB 한 홉만 신뢰하므로 기본 `req.ip`는 Vercel의 출구 IP다. 공개 API 도메인도 직접 호출할 수 있으므로 `trust proxy`를 2로 늘리면 직접 호출자가 `X-Forwarded-For`를 위조할 수 있다.

프론트의 Next.js Proxy는 Vercel이 덮어쓴 단일 `X-Forwarded-For` 주소를 HMAC으로 서명해 내부 요청 헤더로 보낸다. API는 서명과 30초 유효기간을 검증한 경우에만 이 주소를 `req.ip`로 사용한다. 서명이 없거나 올바르지 않으면 ALB 한 홉 기준 주소를 유지한다. 브라우저가 보내는 동일 이름의 헤더는 프론트 Proxy가 제거한다. 원본 IP 또는 서명 값을 로그에 남기지 않는다.

## 운영 활성화

1. 운영자가 충분히 긴 무작위 `API_PROXY_IP_SECRET` 값을 만들고 Vercel 프론트와 API 태스크 양쪽에 **동일한 값**으로 설정한다. GitHub, Terraform state, Issue/PR 또는 로그에 값을 기록하지 않는다.
2. 두 배포를 완료한 뒤 서로 다른 클라이언트에서 `/api/health`의 `X-RateLimit-Remaining` 변화를 비교한다. 같은 클라이언트의 연속 요청은 같은 카운터를 줄이고, 다른 클라이언트의 카운터는 분리돼야 한다.
3. 공개 API 직접 호출에 임의 `X-Forwarded-For` 및 `X-Semochal-Client-IP*` 헤더를 붙여도 ALB가 본 호출자 IP의 제한 키가 유지되는지 확인한다.
4. API 태스크를 늘릴 계획이면 운영 `REDIS_URL`도 설정해 모든 태스크의 제한 카운터를 공유한다. 이 설정은 별도 운영 작업 [#1128](https://github.com/miceplans/demochal/issues/1128)에서 추적한다.

값이 미설정이면 기존 한 홉 IP 처리가 유지된다. 프론트와 API의 설정 시점이 어긋나면 서명 검증에 실패해 동일하게 한 홉 IP로 돌아간다.

참고: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Next.js Proxy request headers](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#setting-headers)
