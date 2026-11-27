---
name: upload-contest
description: 공모전·대외활동 공고 정보(텍스트, 공고 URL, 포스터 이미지, 첨부파일)를 받아 세모챌에 공고로 자동 등록·게시한다. "공모전 올려줘", "이 대외활동 업로드", "공고 등록해줘"처럼 공고를 세모챌에 올려달라는 요청에 사용한다.
---

# 공모전·대외활동 자동 업로드

사용자가 넘긴 정보를 `scripts/upload-contest.mjs` 입력 JSON으로 정리해 업로드한다.
스크립트가 로그인 세션으로 포스터 원본 + 카드 썸네일(WebP, 상단 크롭) + 첨부파일을 올리고
`POST /challenges`(status `published`)로 생성한다. 서버의 `contestAutoPublish`가 꺼져 draft로
저장되면 관리자 계정일 때 `POST /admin/challenges/{id}/publish`로 바로 게시한다.

## 1. 정보 수집

- 텍스트/URL/이미지/PDF 등 사용자가 준 자료를 모두 읽는다. URL이면 페이지를 읽어 내용을 추출한다.
- 포스터 이미지가 URL이면 그대로 `poster`에 넣고, 대화에 첨부된 이미지면 파일 경로를 쓴다.
- 여러 건이면 한 JSON 배열에 모두 담는다.
- 필수값(공고명·주최·상세정보·카테고리·접수 마감일·접수 링크)이 자료에 없으면 **지어내지 말고** 사용자에게 묻는다.

## 2. 입력 JSON 작성 (세션 scratchpad에 `contests.json`)

```json
{
  "contests": [
    {
      "title": "제5회 공공데이터 활용 아이디어 공모전",
      "category": "대회",
      "host": "행정안전부",
      "supervisor": "한국지능정보사회진흥원",
      "sponsor": null,
      "supporter": null,
      "organizerType": "중앙정부/기관",
      "targets": ["대학생", "일반인"],
      "targetOther": null,
      "prizeAmount": 1000,
      "startDate": "2026-11-20",
      "endDate": "2026-12-31",
      "eventStartDate": null,
      "eventEndDate": null,
      "recruitMethod": "external",
      "recruitUrl": "https://example.go.kr/apply",
      "summary": "공공데이터로 사회문제를 해결할 아이디어를 모집합니다.",
      "description": "공고 본문(평문이면 문단 단위로 <p>로 변환된다. HTML도 가능)",
      "hashtags": ["공공데이터", "아이디어"],
      "topics": ["데이터", "사회문제"],
      "inquiryContact": "02-000-0000 / contact@example.go.kr",
      "price": 0,
      "poster": "https://example.go.kr/poster.jpg",
      "attachments": ["./요강.pdf"]
    }
  ]
}
```

필드 규칙(서버 `CreateChallengeDto`와 동일):

| 필드            | 규칙                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `category`      | `IT/SW`, `디자인`, `창업/취업`, `기획`, `광고/마케팅`, `대회`, `해외`, `대외활동`, `홍보`, `강연/강의` 중 하나. 일반 공모전은 주제에 맞는 분야(없으면 `대회`), 서포터즈·기자단·봉사·동아리는 `대외활동` |
| `targets`       | `어린이`, `초등학생`, `중학생`, `고등학생`, `대학생`, `대학원생`, `일반인`, `기업`, `제한없음`, `기타`(→ `targetOther`에 내용)                                                                          |
| `organizerType` | `중앙정부/기관`, `대기업`, `외국계기업`, `학교/재단/협회`, `학회/비영리단체`, `진흥원`, `언론`, `지방자치단체`, `중소/벤처기업`, `기타`                                                                 |
| 날짜            | `YYYY-MM-DD`(시작 00:00, 마감 23:59:59 KST로 채움) 또는 `YYYY-MM-DD HH:mm`(KST). `startDate` 없으면 지금                                                                                                |
| `prizeAmount`   | 총상금 **만원 단위 정수**(1천만원 → `1000`). 모르면 생략                                                                                                                                                |
| `recruitMethod` | 외부 접수면 `external` + `recruitUrl` 필수. 세모챌에서 직접 받으면 `seMOchall`                                                                                                                          |
| `summary`       | 300자 이하 한두 문장                                                                                                                                                                                    |
| `hashtags`      | 20개 이하, `#` 없이                                                                                                                                                                                     |
| `poster`        | 로컬 경로(JSON 파일 기준 상대경로 가능) 또는 http(s) URL. JPG/PNG/WebP, 그 외 형식·10MB 초과는 JPEG로 자동 변환                                                                                         |
| `attachments`   | 10개 이하. pdf/hwp/hwpx/docx/xlsx/pptx/zip/이미지, 각 10MB 이하 (비공개 버킷)                                                                                                                           |

## 3. 검증 → 업로드

API 주소는 사용자가 지정한 환경을 쓴다(지정 없으면 운영인지 로컬인지 묻는다).
운영: `https://www.semochall.com/api`, 로컬: `http://localhost:3001`.

1. 검증: `node scripts/upload-contest.mjs upload <scratchpad>/contests.json --dry-run`
   - ✗ 오류는 JSON을 고쳐 다시 실행, ⚠ 경고는 사용자에게 함께 알린다.
2. 업로드: `node scripts/upload-contest.mjs upload <scratchpad>/contests.json --api <url>`
   - "로그인 세션이 없습니다/만료" 오류면 사용자에게 직접 로그인하도록 안내한다:
     `! node scripts/upload-contest.mjs login --api <url>` (이메일·비밀번호·2FA 코드는 사용자만 입력한다.
     **비밀번호를 대화로 받거나 대신 입력하지 않는다.**) 로그인 후 2를 다시 실행한다.
   - 같은 제목의 공고가 이미 있으면 건너뛴다. 사용자가 중복 등록을 원할 때만 `--force`.
   - 비공개로 올리라는 요청이면 `--draft`.
3. 마지막 줄 `RESULT [...]`의 각 항목(상태·링크·오류)을 사용자에게 표로 보고한다.

## 주의

- 등록은 로그인 계정이 소유한 기업(`/businesses/me`) 명의로 된다(서버가 소유 기업만 허용).
- 공고 내용·포스터의 저작권/출처가 불분명하면 업로드 전에 사용자에게 확인한다.
- 세션은 `~/.config/semochal/upload-session.json`(권한 600)에 API 주소별로 저장된다. 지우려면 `logout`.
