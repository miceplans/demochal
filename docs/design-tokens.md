# 세모챌 디자인 토큰

출처: [Figma UX/UI 페이지](https://www.figma.com/design/jQRZ2OlZZMxwyQZWxxtkXy?node-id=195-956), 2026-09-08 추출.

## 범위

파일에 등록된 컬러 변수 13개, 페인트 스타일 12개(그라디언트 2개 포함), 텍스트 스타일 51개, 효과 스타일 1개를 가져왔다. 원본은 `figma-tokens.source.json`, 프로젝트용 정규화 데이터는 `design-tokens.json`, CSS는 `../front/src/styles/tokens.css`에 있다. 화면별 개별 값 및 간격/모서리 반경은 등록 토큰으로 확인되지 않아 임의 추가하지 않았다.

## 글꼴 규칙

모든 UI 텍스트는 Pretendard만 사용한다. 다른 서체는 로고 아트워크에만 허용한다. 원본의 Inter/Noto Sans KR 스타일도 프로젝트용 데이터와 CSS에서는 Pretendard로 변환했으며 크기, 굵기, 행간은 유지했다. AUTO 행간은 CSS normal로 옮겼다. 원본 JSON의 타 서체명은 추적용 기록이다.

CSS는 토큰 추출 산출물이며 아직 앱에 import하지 않았다. 실제 화면 적용 시 Pretendard 폰트 파일을 로드하고 기본 템플릿 서체를 제거해야 한다.

## 컬러

| Figma 변수 | CSS 변수              | HEX       |
| ---------- | --------------------- | --------- |
| SEMO       | `--color-semo`        | `#006fff` |
| LightBlue  | `--color-light-blue`  | `#cfe4ff` |
| LightGreen | `--color-light-green` | `#f0fdf4` |
| Green      | `--color-green`       | `#22c55e` |
| LightRed   | `--color-light-red`   | `#fff0eb` |
| Red        | `--color-red`         | `#ff4d00` |
| gray/100   | `--color-gray-100`    | `#f4f4f4` |
| gray/500   | `--color-gray-500`    | `#858a99` |
| gray/700   | `--color-gray-700`    | `#636c7f` |
| gray/900   | `--color-gray-900`    | `#101010` |
| gray/50    | `--color-gray-50`     | `#fdfdfd` |
| gray/200   | `--color-gray-200`    | `#dfe2e7` |
| gray/300   | `--color-gray-300`    | `#c9ccd2` |

## 원본 이름 불일치

색상 기준은 연결된 변수 값이다. 페인트 스타일 이름을 변수 이름으로 오인하지 않는다.

| 페인트 스타일 | 연결 변수 |
| ------------- | --------- |
| gray/300      | gray/500  |
| gray/500      | gray/700  |
| gray/700      | gray/900  |

## 텍스트 스타일

CSS의 `type-*` 클래스로 사용한다. 모든 자간은 0이다.

| 원본 이름          | 클래스                  | px  | 굵기 | 행간   |
| ------------------ | ----------------------- | --- | ---- | ------ |
| Display            | type-display            | 24  | 600  | normal |
| H1                 | type-h1                 | 16  | 600  | normal |
| Body Large         | type-body-large         | 16  | 400  | 1.5    |
| H2                 | type-h2                 | 15  | 600  | normal |
| Body               | type-body               | 15  | 400  | normal |
| H3                 | type-h3                 | 14  | 600  | normal |
| Body Small         | type-body-small         | 14  | 400  | normal |
| Subtitle           | type-subtitle           | 13  | 600  | 1.4    |
| Caption            | type-caption            | 13  | 400  | normal |
| Overline           | type-overline           | 12  | 600  | normal |
| Label              | type-label              | 11  | 600  | normal |
| Button Label       | type-button-label       | 14  | 600  | normal |
| Secondary Text     | type-secondary-text     | 13  | 400  | normal |
| Meta Text          | type-meta-text          | 12  | 400  | normal |
| Meta Detail        | type-meta-detail        | 12  | 400  | normal |
| Fine Print         | type-fine-print         | 11  | 400  | normal |
| H1 2               | type-h1-2               | 20  | 600  | 1.3    |
| H2 2               | type-h2-2               | 18  | 700  | normal |
| Subtitle 2         | type-subtitle-2         | 18  | 700  | normal |
| H3 2               | type-h3-2               | 16  | 600  | normal |
| Title              | type-title              | 16  | 700  | normal |
| Body Strong        | type-body-strong        | 15  | 600  | normal |
| Label Large        | type-label-large        | 15  | 700  | 1.4    |
| Body Small 2       | type-body-small-2       | 14  | 600  | normal |
| Caption 2          | type-caption-2          | 13  | 600  | 1.4    |
| Fine Print 2       | type-fine-print-2       | 13  | 400  | normal |
| Label 2            | type-label-2            | 12  | 400  | normal |
| Label Small        | type-label-small        | 11  | 600  | normal |
| m/Hero Heading     | type-m-hero-heading     | 24  | 600  | normal |
| m/Header Title     | type-m-header-title     | 20  | 600  | 1.3    |
| m/Section Heading  | type-m-section-heading  | 18  | 700  | normal |
| m/Body Text        | type-m-body-text        | 16  | 400  | 1.5    |
| m/Panel Title      | type-m-panel-title      | 16  | 600  | normal |
| m/List Text        | type-m-list-text        | 15  | 400  | normal |
| m/Name Label       | type-m-name-label       | 15  | 600  | normal |
| m/Timestamp        | type-m-timestamp        | 15  | 500  | normal |
| m/Card Title       | type-m-card-title       | 14  | 600  | normal |
| m/Block Title      | type-m-block-title      | 14  | 700  | normal |
| m/Tab Label        | type-m-tab-label        | 14  | 500  | normal |
| m/Feature Title    | type-m-feature-title    | 13  | 600  | 1.4    |
| m/Body Detail      | type-m-body-detail      | 13  | 400  | normal |
| m/Description Text | type-m-description-text | 13  | 400  | normal |
| m/Mini Card Title  | type-m-mini-card-title  | 13  | 500  | 1.35   |
| m/Info Text        | type-m-info-text        | 12  | 400  | normal |
| m/Counter Text     | type-m-counter-text     | 12  | 600  | normal |
| m/Sub Text         | type-m-sub-text         | 12  | 400  | normal |
| m/Badge Text       | type-m-badge-text       | 11  | 600  | normal |
| m/Tag Text         | type-m-tag-text         | 11  | 400  | normal |
| m/Index Number     | type-m-index-number     | 11  | 700  | normal |
| m/Role Text        | type-m-role-text        | 11  | 500  | normal |
| m/Micro Tag        | type-m-micro-tag        | 10  | 500  | normal |

## 효과 및 그라디언트

- toastDropShadow: `4px 4px 10px 0 rgb(0 0 0 / 20%)`.
- SEMO-Gradient: 방사형. 원본의 gradientStops와 gradientTransform을 원본 JSON에 보존했다.
- Gradient: 선형. 원본의 gradientStops와 gradientTransform을 원본 JSON에 보존했다.
- 그라디언트는 대상 프레임의 비율에 따라 변환이 달라지므로 임의의 CSS 각도로 치환하지 않았다.
