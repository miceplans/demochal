#!/usr/bin/env node
/**
 * 공모전·대외활동 공고 자동 업로드 CLI.
 *
 * 공고 정보를 담은 JSON을 받아 로그인 세션으로 포스터/썸네일·첨부파일을 업로드하고
 * POST /challenges 로 공고를 생성한 뒤 공개(published)까지 처리한다.
 * Claude Code 스킬(.claude/skills/upload-contest)이 이 스크립트를 호출한다.
 *
 *   node scripts/upload-contest.mjs login  [--api <url>]          # 대화형 로그인(2FA 포함) → 세션 캐시
 *   node scripts/upload-contest.mjs upload <json> [--api <url>] [--dry-run] [--force] [--draft]
 *   node scripts/upload-contest.mjs logout [--api <url>]
 *
 * API 주소: --api 또는 SEMOCHAL_API_URL (예: https://www.semochall.com/api, http://localhost:3001)
 * 인증: SEMOCHAL_ACCESS_TOKEN(세션 쿠키 값) → 캐시된 세션(~/.config/semochal/upload-session.json) 순.
 * 비밀번호·2FA 코드는 login 명령에서만 대화형으로 받고 파일에 남기지 않는다.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const AUTH_COOKIE_NAME = 'semochal_access_token';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const THUMBNAIL_SIZE = { width: 832, height: 830 }; // 프론트 POSTER_THUMBNAIL_ASPECT(416/415)와 동일 비율
const SESSION_FILE = path.join(homedir(), '.config', 'semochal', 'upload-session.json');

// server/src/modules/challenges/challenge-filter-options.ts · BizPostingFormPage 카테고리와 동기화
export const CATEGORIES = [
  'IT/SW',
  '디자인',
  '창업/취업',
  '기획',
  '광고/마케팅',
  '대회',
  '해외',
  '대외활동',
  '홍보',
  '강연/강의',
];
export const TARGETS = [
  '어린이',
  '초등학생',
  '중학생',
  '고등학생',
  '대학생',
  '대학원생',
  '제한없음',
  '기타',
  '일반인',
  '기업',
];
export const ORGANIZER_TYPES = [
  '중앙정부/기관',
  '대기업',
  '외국계기업',
  '학교/재단/협회',
  '학회/비영리단체',
  '진흥원',
  '언론',
  '지방자치단체',
  '중소/벤처기업',
  '기타',
];

const ATTACHMENT_TYPES = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.hwp': 'application/x-hwp',
  '.hwpx': 'application/hwp+zip',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// ------------------------------------------------------------------ 순수 로직(테스트 대상)

/**
 * 날짜 입력을 KST 기준 ISO 문자열로 맞춘다.
 * 'YYYY-MM-DD'만 오면 시작은 00:00, 종료는 23:59:59(KST)로 채운다. 오프셋이 없는 시각은 KST로 본다.
 */
export function toKstIso(value, edge = 'start') {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = String(value)
    .trim()
    .replace(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\.?/, '$1-$2-$3') // 2026.12.31 표기
    .replace(/\s+/, 'T');
  let iso;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    iso = `${date}T${edge === 'end' ? '23:59:59' : '00:00:00'}+09:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    iso = `${raw.length === 16 ? `${raw}:00` : raw}+09:00`;
  } else {
    iso = raw;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) throw new Error(`날짜 형식을 해석할 수 없습니다: ${value}`);
  return iso;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 평문 상세정보를 에디터 호환 HTML(<p> 문단)로 바꾼다. 이미 HTML이면 그대로 둔다(서버가 정화). */
export function toDescriptionHtml(text) {
  const value = String(text ?? '').trim();
  if (!value) return '';
  if (/<(p|div|br|ul|ol|h[1-6]|strong|b|table)\b/i.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function cleanList(list) {
  if (list === undefined || list === null) return undefined;
  const arr = Array.isArray(list) ? list : String(list).split(',');
  const out = [...new Set(arr.map((x) => String(x).trim().replace(/^#/, '')).filter(Boolean))];
  return out.length ? out : undefined;
}

function optionalText(value, max, field, errors) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (text.length > max) errors.push(`${field}: ${max}자 이하여야 합니다(현재 ${text.length}자).`);
  return text;
}

/**
 * 입력 항목 하나를 검증하고 CreateChallengeDto 페이로드(파일 id 제외)로 정규화한다.
 * 반환: { payload, poster, attachments, errors, warnings }
 */
export function normalizeContest(item, { now = new Date() } = {}) {
  const errors = [];
  const warnings = [];
  const payload = {};

  const title = optionalText(item.title, 200, 'title', errors);
  if (!title) errors.push('title(공고명)은 필수입니다.');
  payload.title = title;

  const host = optionalText(item.host, 200, 'host', errors);
  if (!host) errors.push('host(주최)는 필수입니다.');
  payload.host = host;
  for (const key of ['supervisor', 'sponsor', 'supporter']) {
    const v = optionalText(item[key], 200, key, errors);
    if (v) payload[key] = v;
  }

  const description = toDescriptionHtml(item.description);
  if (!description) errors.push('description(상세정보)는 필수입니다.');
  if (description.length > 100_000) errors.push('description: 100,000자 이하여야 합니다.');
  payload.description = description;

  const price = item.price === undefined || item.price === null ? 0 : Number(item.price);
  if (!Number.isInteger(price) || price < 0)
    errors.push('price(참가비)는 0 이상의 정수여야 합니다.');
  payload.price = price;

  try {
    payload.startDate = toKstIso(item.startDate ?? now.toISOString(), 'start');
    if (item.startDate === undefined) warnings.push('startDate가 없어 지금 시각으로 설정했습니다.');
    payload.endDate = toKstIso(item.endDate, 'end');
    if (!payload.endDate) errors.push('endDate(접수 마감일)는 필수입니다.');
  } catch (error) {
    errors.push(error.message);
  }
  if (payload.startDate && payload.endDate) {
    if (new Date(payload.endDate) < new Date(payload.startDate))
      errors.push('endDate는 startDate 이후여야 합니다.');
    if (new Date(payload.endDate) < now) warnings.push('접수 마감일이 이미 지났습니다.');
  }

  try {
    const eventStart = toKstIso(item.eventStartDate, 'start');
    const eventEnd = toKstIso(item.eventEndDate, 'end');
    if (eventStart || eventEnd) {
      // 서버는 행사 기간을 시작·종료 쌍으로 받는다. 한쪽만 있으면 같은 날로 맞춘다.
      payload.eventStartDate = eventStart ?? toKstIso(item.eventEndDate, 'start');
      payload.eventEndDate = eventEnd ?? toKstIso(item.eventStartDate, 'end');
    }
  } catch (error) {
    errors.push(error.message);
  }

  const category = optionalText(item.category, 100, 'category', errors);
  if (!category) errors.push(`category는 필수입니다(${CATEGORIES.join(', ')}).`);
  else if (!CATEGORIES.includes(category))
    warnings.push(`category '${category}'는 표준 목록(${CATEGORIES.join(', ')})에 없습니다.`);
  payload.category = category;

  const targets = cleanList(item.targets);
  if (targets) {
    const invalid = targets.filter((t) => !TARGETS.includes(t));
    if (invalid.length) errors.push(`targets 허용값이 아닙니다: ${invalid.join(', ')}`);
    payload.targets = targets;
    const targetOther = optionalText(item.targetOther, 100, 'targetOther', errors);
    if (targets.includes('기타')) {
      if (!targetOther) warnings.push("targets에 '기타'가 있지만 targetOther가 비어 있습니다.");
      else payload.targetOther = targetOther;
    }
  }

  if (item.organizerType) {
    if (!ORGANIZER_TYPES.includes(item.organizerType))
      errors.push(`organizerType 허용값이 아닙니다: ${item.organizerType}`);
    else payload.organizerType = item.organizerType;
  }

  if (item.prizeAmount !== undefined && item.prizeAmount !== null && item.prizeAmount !== '') {
    const prize = Number(item.prizeAmount);
    if (!Number.isInteger(prize) || prize < 0)
      errors.push('prizeAmount(총상금, 만원 단위)는 0 이상의 정수여야 합니다.');
    else payload.prizeAmount = prize;
  }

  const recruitMethod = item.recruitMethod ?? 'external';
  if (!['external', 'seMOchall'].includes(recruitMethod))
    errors.push("recruitMethod는 'external' 또는 'seMOchall'이어야 합니다.");
  payload.recruitMethod = recruitMethod;
  if (recruitMethod === 'external') {
    const url = optionalText(item.recruitUrl, 2048, 'recruitUrl', errors);
    if (!url) errors.push('recruitMethod가 external이면 recruitUrl(접수 링크)이 필수입니다.');
    else if (!/^https?:\/\/\S+$/i.test(url))
      errors.push('recruitUrl은 http(s):// 로 시작해야 합니다.');
    payload.recruitUrl = url;
  }

  const summary = optionalText(item.summary, 300, 'summary', errors);
  if (summary) payload.summary = summary;
  const inquiryContact = optionalText(item.inquiryContact, 200, 'inquiryContact', errors);
  if (inquiryContact) payload.inquiryContact = inquiryContact;

  const hashtags = cleanList(item.hashtags);
  if (hashtags) {
    if (hashtags.length > 20) errors.push('hashtags는 20개 이하여야 합니다.');
    if (hashtags.some((h) => h.length > 50)) errors.push('hashtag는 각 50자 이하여야 합니다.');
    payload.hashtags = hashtags;
  }
  const topics = cleanList(item.topics);
  if (topics) {
    if (topics.length > 30) errors.push('topics는 30개 이하여야 합니다.');
    payload.topics = topics;
  }

  payload.visibility = item.visibility === 'private' ? 'private' : 'public';

  const poster = item.poster ? String(item.poster).trim() : undefined;
  if (!poster) warnings.push('poster가 없어 포스터·썸네일 없이 등록됩니다.');
  const attachments = cleanList(item.attachments) ?? [];
  if (attachments.length > MAX_ATTACHMENTS)
    errors.push(`attachments는 ${MAX_ATTACHMENTS}개 이하여야 합니다.`);

  return { payload, poster, attachments, errors, warnings };
}

/** JSON 입력(단일 객체 · 배열 · { contests: [] })을 항목 배열로 만든다. */
export function parseInput(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.contests)) return json.contests;
  if (json && typeof json === 'object') return [json];
  throw new Error('입력 JSON은 객체, 배열, 또는 { "contests": [...] } 형태여야 합니다.');
}

export function normalizeTitle(title) {
  return String(title ?? '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 이미지 바이트의 실제 형식을 시그니처로 판별한다(서버 finalize 검증과 같은 기준). */
export function detectImageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  if (
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return undefined;
}

export function readSetCookieToken(headers) {
  const cookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    if (pair?.startsWith(`${AUTH_COOKIE_NAME}=`)) {
      return decodeURIComponent(pair.slice(AUTH_COOKIE_NAME.length + 1));
    }
  }
  return undefined;
}

// ------------------------------------------------------------------ 세션/HTTP

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--api') args.api = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--draft') args.draft = true;
    else args._.push(arg);
  }
  return args;
}

function resolveApiUrl(args) {
  const url = args.api ?? process.env.SEMOCHAL_API_URL;
  if (!url) {
    throw new Error(
      'API 주소가 필요합니다: --api <url> 또는 SEMOCHAL_API_URL (예: https://www.semochall.com/api, http://localhost:3001)',
    );
  }
  return url.replace(/\/$/, '');
}

async function readSessions() {
  try {
    return JSON.parse(await readFile(SESSION_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function saveSession(apiUrl, token) {
  const sessions = await readSessions();
  if (token) sessions[apiUrl] = { token, savedAt: new Date().toISOString() };
  else delete sessions[apiUrl];
  await mkdir(path.dirname(SESSION_FILE), { recursive: true, mode: 0o700 });
  await writeFile(SESSION_FILE, JSON.stringify(sessions, null, 2), { mode: 0o600 });
}

class ApiError extends Error {
  constructor(status, body, method, pathname) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    super(`${method} ${pathname} → ${status}${message ? `: ${message}` : ''}`);
    this.status = status;
  }
}

function createApi(apiUrl, token) {
  return async function api(method, pathname, body) {
    const res = await fetch(`${apiUrl}${pathname}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!res.ok) throw new ApiError(res.status, data, method, pathname);
    return { data, headers: res.headers };
  };
}

async function resolveToken(apiUrl) {
  if (process.env.SEMOCHAL_ACCESS_TOKEN) return process.env.SEMOCHAL_ACCESS_TOKEN;
  const sessions = await readSessions();
  return sessions[apiUrl]?.token;
}

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      // 입력 에코를 숨긴다(비밀번호·2FA 코드).
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function login(apiUrl) {
  if (!process.stdin.isTTY) {
    throw new Error(
      'login은 대화형 터미널에서만 실행할 수 있습니다. Claude Code에서는 `! node scripts/upload-contest.mjs login --api <url>` 로 직접 실행하세요.',
    );
  }
  const api = createApi(apiUrl);
  const email = await prompt('이메일: ');
  const password = await prompt('비밀번호: ', { hidden: true });
  const { data, headers } = await api('POST', '/auth/login', { email, password });
  let token = readSetCookieToken(headers);
  if (!token && data?.mfaEnrollmentRequired) {
    throw new Error('2FA 등록이 필요한 계정입니다. 웹에서 2FA를 먼저 등록한 뒤 다시 시도하세요.');
  }
  if (!token && data?.mfaRequired) {
    if (!data.methods?.includes?.('totp') && data.methods) {
      throw new Error(
        `이 계정의 2FA 수단(${data.methods.join(', ')})은 CLI에서 지원하지 않습니다(TOTP만 지원).`,
      );
    }
    const code = await prompt('2FA 인증 코드(6자리): ', { hidden: true });
    const verified = await api('POST', '/auth/mfa/verify/totp', { mfaToken: data.mfaToken, code });
    token = readSetCookieToken(verified.headers);
  }
  if (!token) throw new Error('로그인 응답에서 세션 쿠키를 받지 못했습니다.');
  await saveSession(apiUrl, token);
  const me = await createApi(apiUrl, token)('GET', '/auth/me');
  console.log(`✓ 로그인 완료 (${me.data?.role ?? 'unknown'}) — 세션 저장됨: ${SESSION_FILE}`);
}

// ------------------------------------------------------------------ 파일 업로드

async function loadSource(source, baseDir) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`파일 다운로드 실패(${res.status}): ${source}`);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > 3 * MAX_UPLOAD_BYTES) throw new Error(`파일이 너무 큽니다: ${source}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const name = decodeURIComponent(new URL(source).pathname.split('/').pop() || 'file');
    return { bytes, name };
  }
  const filePath = path.resolve(baseDir, source);
  const info = await stat(filePath);
  if (info.size > 3 * MAX_UPLOAD_BYTES) throw new Error(`파일이 너무 큽니다: ${filePath}`);
  return { bytes: new Uint8Array(await readFile(filePath)), name: path.basename(filePath) };
}

function loadSharp() {
  // sharp는 server 워크스페이스 의존성이다 — 루트에 새 의존성을 추가하지 않고 그대로 빌려 쓴다.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const require = createRequire(path.join(here, '..', 'server', 'package.json'));
  return require('sharp');
}

async function uploadFile(api, { bytes, contentType, fileName, bucket, purpose }) {
  if (bytes.byteLength > MAX_UPLOAD_BYTES)
    throw new Error(`${fileName}: 10MB를 초과해 업로드할 수 없습니다.`);
  const safeName = fileName.replace(/[/\\]/g, '_').slice(0, 255);
  const { data: presigned } = await api('POST', '/files/presign', {
    bucket,
    contentType,
    fileName: safeName,
    sizeBytes: bytes.byteLength,
    ...(purpose && { purpose }),
  });
  const put = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`${fileName}: S3 업로드 실패(${put.status})`);
  await api('POST', `/files/${presigned.fileId}/finalize`);
  return presigned.fileId;
}

/** 포스터 원본(10MB 초과 시 JPEG 재압축)과 카드 썸네일(WebP, 상단 기준 크롭)을 올린다. */
async function uploadPoster(api, source, baseDir) {
  const sharp = loadSharp();
  const { bytes, name } = await loadSource(source, baseDir);
  let posterBytes = bytes;
  let posterType = detectImageType(bytes);
  let posterName = name;
  if (!posterType || bytes.byteLength > MAX_UPLOAD_BYTES) {
    // GIF/HEIC 등 미지원 형식이거나 용량 초과면 JPEG로 변환한다.
    posterBytes = new Uint8Array(
      await sharp(bytes)
        .rotate()
        .resize({ width: 2000, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),
    );
    posterType = 'image/jpeg';
    posterName = `${path.parse(name).name || 'poster'}.jpg`;
  }
  const thumbnailBytes = new Uint8Array(
    await sharp(bytes)
      .rotate()
      .resize({ ...THUMBNAIL_SIZE, fit: 'cover', position: 'top' })
      .webp({ quality: 85 })
      .toBuffer(),
  );
  const posterFileId = await uploadFile(api, {
    bytes: posterBytes,
    contentType: posterType,
    fileName: posterName,
    bucket: 'public',
    purpose: 'poster',
  });
  const thumbnailFileId = await uploadFile(api, {
    bytes: thumbnailBytes,
    contentType: 'image/webp',
    fileName: `${path.parse(posterName).name || 'poster'}-thumbnail.webp`,
    bucket: 'public',
  });
  return { posterFileId, thumbnailFileId };
}

async function uploadAttachment(api, source, baseDir) {
  const { bytes, name } = await loadSource(source, baseDir);
  const contentType = ATTACHMENT_TYPES[path.extname(name).toLowerCase()];
  if (!contentType) throw new Error(`지원하지 않는 첨부파일 형식입니다: ${name}`);
  const fileId = await uploadFile(api, { bytes, contentType, fileName: name, bucket: 'private' });
  return { fileId, name, size: bytes.byteLength };
}

// ------------------------------------------------------------------ 업로드 명령

async function listMyTitles(api) {
  const titles = new Map();
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ limit: '100', ...(cursor && { cursor }) });
    const { data } = await api('GET', `/businesses/me/challenges?${query}`);
    const items = data?.items ?? [];
    for (const item of items) titles.set(normalizeTitle(item.title), item);
    cursor = data?.nextCursor;
    if (!cursor || !items.length) break;
  }
  return titles;
}

function siteOrigin(apiUrl) {
  const url = new URL(apiUrl);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return 'http://localhost:3000';
  return url.origin;
}

async function upload(apiUrl, file, { dryRun, force, draft }) {
  const inputPath = path.resolve(file);
  const items = parseInput(JSON.parse(await readFile(inputPath, 'utf8')));
  const baseDir = path.dirname(inputPath);
  const normalized = items.map((item) => normalizeContest(item));
  // 로컬 파일 경로는 업로드 전에 존재 여부를 확인한다(URL은 업로드 시점에 받는다).
  for (const n of normalized) {
    for (const source of [n.poster, ...n.attachments].filter(Boolean)) {
      if (/^https?:\/\//i.test(source)) continue;
      try {
        await stat(path.resolve(baseDir, source));
      } catch {
        n.errors.push(`파일을 찾을 수 없습니다: ${source}`);
      }
    }
  }

  let hasError = false;
  normalized.forEach((n, i) => {
    const label = `[${i + 1}/${items.length}] ${n.payload.title ?? '(제목 없음)'}`;
    console.log(label);
    for (const w of n.warnings) console.log(`  ⚠ ${w}`);
    for (const e of n.errors) console.log(`  ✗ ${e}`);
    if (n.errors.length) hasError = true;
  });
  if (hasError)
    throw new Error('검증 오류가 있어 업로드하지 않았습니다. 입력 JSON을 고친 뒤 다시 실행하세요.');

  if (dryRun) {
    console.log('\n--dry-run: 업로드 없이 전송될 페이로드만 출력합니다.');
    console.log(
      JSON.stringify(
        normalized.map((n) => ({ ...n.payload, poster: n.poster, attachments: n.attachments })),
        null,
        2,
      ),
    );
    return;
  }

  const token = await resolveToken(apiUrl);
  if (!token) {
    throw new Error(
      `로그인 세션이 없습니다. 먼저 \`node scripts/upload-contest.mjs login --api ${apiUrl}\` 을 실행하세요.`,
    );
  }
  const api = createApi(apiUrl, token);
  let me;
  try {
    ({ data: me } = await api('GET', '/auth/me'));
  } catch (error) {
    if (error.status === 401) {
      await saveSession(apiUrl, undefined);
      throw new Error('세션이 만료됐습니다. login 명령으로 다시 로그인하세요.');
    }
    throw error;
  }
  const role = me?.role;
  const { data: business } = await api('GET', '/businesses/me');
  const businessId = business?.id;
  if (!businessId) throw new Error('이 계정에 등록된 기업 정보가 없습니다(/businesses/me).');
  const existing = force ? new Map() : await listMyTitles(api);

  const results = [];
  for (const [i, n] of normalized.entries()) {
    const label = `[${i + 1}/${normalized.length}] ${n.payload.title}`;
    const duplicate = existing.get(normalizeTitle(n.payload.title));
    if (duplicate) {
      console.log(
        `${label} — 이미 같은 제목의 공고가 있어 건너뜀 (id=${duplicate.id}, --force로 무시)`,
      );
      results.push({ title: n.payload.title, skipped: true, id: duplicate.id });
      continue;
    }
    try {
      const files = n.poster ? await uploadPoster(api, n.poster, baseDir) : {};
      const attachments = [];
      for (const source of n.attachments)
        attachments.push(await uploadAttachment(api, source, baseDir));
      const { data: created } = await api('POST', '/challenges', {
        ...n.payload,
        businessId,
        ...files,
        ...(attachments.length && { attachments }),
        status: draft ? 'draft' : 'published',
      });
      let status = created.status;
      // contestAutoPublish가 꺼져 있으면 서버가 draft로 저장한다 — 관리자 계정이면 바로 게시 승인한다.
      if (!draft && status === 'draft') {
        if (role === 'admin') {
          ({
            data: { status },
          } = await api('POST', `/admin/challenges/${created.id}/publish`));
        } else {
          console.log('  ⚠ 자동 게시가 꺼져 있어 draft로 저장됐습니다(관리자 승인 필요).');
        }
      }
      const url = `${siteOrigin(apiUrl)}/contests/${created.id}`;
      console.log(`${label} — ✓ ${status} ${url}`);
      results.push({ title: n.payload.title, id: created.id, status, url });
      existing.set(normalizeTitle(n.payload.title), created);
    } catch (error) {
      console.log(`${label} — ✗ ${error.message}`);
      results.push({ title: n.payload.title, error: error.message });
    }
  }
  console.log(`\nRESULT ${JSON.stringify(results)}`);
  if (results.some((r) => r.error)) process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [command, file] = args._;
  if (command === 'login') return login(resolveApiUrl(args));
  if (command === 'logout') {
    const apiUrl = resolveApiUrl(args);
    await saveSession(apiUrl, undefined);
    return console.log('✓ 저장된 세션을 삭제했습니다.');
  }
  if (command === 'upload' && file) {
    // --dry-run은 서버에 접속하지 않으므로 API 주소 없이도 실행된다.
    const apiUrl =
      args.dryRun && !args.api && !process.env.SEMOCHAL_API_URL ? '' : resolveApiUrl(args);
    return upload(apiUrl, file, args);
  }
  console.log(
    '사용법:\n  node scripts/upload-contest.mjs login --api <url>\n  node scripts/upload-contest.mjs upload <json> --api <url> [--dry-run] [--force] [--draft]\n  node scripts/upload-contest.mjs logout --api <url>',
  );
  process.exitCode = command ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  });
}
