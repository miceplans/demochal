const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  hwp: 'application/x-hwp',
  hwpx: 'application/hwp+zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// 카드 썸네일 슬롯 비율 — 크롭 모달 프레임과 OCR 위치 계산이 같이 쓴다.
const POSTER_THUMBNAIL_ASPECT = 416 / 415;

export {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  POSTER_THUMBNAIL_ASPECT,
  POSTER_TYPES,
};
