import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectImageType,
  normalizeContest,
  normalizeTitle,
  parseInput,
  readSetCookieToken,
  toDescriptionHtml,
  toKstIso,
} from './upload-contest.mjs';

const now = new Date('2026-11-19T00:00:00+09:00');
const base = {
  title: '제5회 공공데이터 활용 아이디어 공모전',
  host: '행정안전부',
  category: '대회',
  description: '공공데이터를 활용한 아이디어를 모집합니다.\n\n시상: 대상 1팀',
  startDate: '2026-11-20',
  endDate: '2026.12.31',
  recruitUrl: 'https://example.com/apply',
  targets: ['대학생', '일반인'],
  organizerType: '중앙정부/기관',
  prizeAmount: 1000,
  hashtags: ['#공공데이터', '아이디어', '아이디어'],
  poster: './poster.png',
};

test('date-only input is filled to KST start/end of day', () => {
  assert.equal(toKstIso('2026-12-31', 'end'), '2026-12-31T23:59:59+09:00');
  assert.equal(toKstIso('2026.1.5', 'start'), '2026-01-05T00:00:00+09:00');
  assert.equal(toKstIso('2026-12-31 18:00', 'end'), '2026-12-31T18:00:00+09:00');
  assert.equal(toKstIso('2026-12-31T09:00:00Z'), '2026-12-31T09:00:00Z');
  assert.throws(() => toKstIso('내일'), /해석할 수 없습니다/);
});

test('plain text description becomes escaped paragraphs; HTML passes through', () => {
  assert.equal(toDescriptionHtml('1<2 & 3>2\nc\n\nd'), '<p>1&lt;2 &amp; 3&gt;2<br>c</p><p>d</p>');
  assert.equal(toDescriptionHtml('<p>hi</p>'), '<p>hi</p>');
});

test('valid contest is normalized into a CreateChallengeDto payload', () => {
  const { payload, errors, poster } = normalizeContest(base, { now });
  assert.deepEqual(errors, []);
  assert.equal(payload.endDate, '2026-12-31T23:59:59+09:00');
  assert.equal(payload.recruitMethod, 'external');
  assert.equal(payload.price, 0);
  assert.equal(payload.visibility, 'public');
  assert.deepEqual(payload.hashtags, ['공공데이터', '아이디어']);
  assert.equal(poster, './poster.png');
  assert.ok(!('status' in payload) && !('businessId' in payload));
});

test('missing required fields and invalid enums are reported', () => {
  const { errors } = normalizeContest(
    { title: 'x', targets: ['외계인'], organizerType: '우주', recruitUrl: 'ftp://x' },
    { now },
  );
  const joined = errors.join('\n');
  for (const needle of [
    'host',
    'description',
    'endDate',
    'category',
    'targets',
    'organizerType',
    'recruitUrl',
  ]) {
    assert.match(joined, new RegExp(needle));
  }
});

test('non-standard category is a warning, past deadline is a warning', () => {
  const { errors, warnings } = normalizeContest(
    { ...base, category: '봉사', endDate: '2026-01-01', startDate: '2025-12-01' },
    { now },
  );
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes('봉사')));
  assert.ok(warnings.some((w) => w.includes('지났습니다')));
});

test('half event period is completed to a single day', () => {
  const { payload } = normalizeContest({ ...base, eventStartDate: '2027-01-10' }, { now });
  assert.equal(payload.eventStartDate, '2027-01-10T00:00:00+09:00');
  assert.equal(payload.eventEndDate, '2027-01-10T23:59:59+09:00');
});

test('seMOchall recruit method does not require recruitUrl', () => {
  const { payload, errors } = normalizeContest(
    { ...base, recruitMethod: 'seMOchall', recruitUrl: undefined },
    { now },
  );
  assert.deepEqual(errors, []);
  assert.ok(!('recruitUrl' in payload));
});

test('input accepts object, array and { contests }', () => {
  assert.equal(parseInput(base).length, 1);
  assert.equal(parseInput([base, base]).length, 2);
  assert.equal(parseInput({ contests: [base] }).length, 1);
  assert.throws(() => parseInput('x'));
});

test('helpers: title normalization, image sniffing, cookie parsing', () => {
  assert.equal(normalizeTitle(' 제5회  공모전 '), normalizeTitle('제5회공모전'));
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), 'image/png');
  assert.equal(detectImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(detectImageType(new TextEncoder().encode('GIF89a')), undefined);
  const headers = new Headers();
  headers.append('set-cookie', 'other=1; Path=/');
  headers.append('set-cookie', 'semochal_access_token=abc%2Edef; Path=/; HttpOnly');
  assert.equal(readSetCookieToken(headers), 'abc.def');
});
