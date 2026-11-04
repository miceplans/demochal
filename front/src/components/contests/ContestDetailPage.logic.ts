import { formatDateDot, formatDateTimeDot } from '@/lib/date';

const formatDate = (value?: string) => (value ? formatDateDot(value) : '');
const formatDateTime = (value?: string) => (value ? formatDateTimeDot(value) : '');

// 줄바꿈 없이 이어 붙은 평문 공고는 항목 기호(○, " - ") 앞에서 줄을 나눠 보여준다.
const splitPlainItems = (text: string) =>
  text.includes('\n')
    ? text
    : text
        .replace(/\s*○\s*/g, '\n○ ')
        .replace(/ - (?=\S)/g, '\n- ')
        .trim();

// 공고 포스터 크롭 썸네일 비율(등록 폼의 POSTER_THUMBNAIL_ASPECT와 동일) — 상세 포스터 슬롯도
// 이 비율로 노출해 사용자가 자른 영역이 잘리지 않고 그대로 보이게 한다.
const POSTER_ASPECT = '416 / 415';

export { formatDate, formatDateTime, POSTER_ASPECT, splitPlainItems };
