const STAR = '*';

/** 전체를 *로 가립니다. */
export function maskAll(value: string): string {
  return value.replace(/[^\s]/g, STAR);
}

/** 카드번호: '3778123456781234' 또는 '3778 1234 5678 1234' → '3778 **** **** 1234' */
export function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8) return maskAll(value);
  const first = digits.slice(0, 4);
  const last = digits.slice(-4);
  const middleGroups = Math.max(0, Math.floor((digits.length - 8) / 4));
  return [first, ...Array.from({ length: middleGroups }, () => '****'), last].join(' ');
}

/** 사업자등록번호: '110-81-12345' → '110-**-*****' */
export function maskBizNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return maskAll(value);
  return `${digits.slice(0, 3)}-**-${STAR.repeat(5)}`;
}

/** 전화번호: '051-783-1170' → '051-***-1170', '010-1234-5678' → '010-****-5678' */
export function maskPhone(value: string): string {
  const segments = value.split('-');
  if (segments.length < 2) return maskAll(value);
  return segments
    .map((segment, index) => {
      if (index === 0) return segment;
      if (index === segments.length - 1) return segment.length <= 4 ? segment : `${STAR.repeat(segment.length - 4)}${segment.slice(-4)}`;
      return STAR.repeat(segment.length);
    })
    .join('-');
}

/** 이메일: 'yuiyui6780@miceplans.com' → 'yu********@miceplans.com' */
export function maskEmail(value: string): string {
  const [local = '', domain = ''] = value.split('@');
  if (!domain) return maskAll(value);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${STAR.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

/** 성명: '황지영' → '황*영', '김창' → '김*' */
export function maskName(value: string): string {
  if (value.length <= 1) return STAR;
  return `${value[0]}${STAR.repeat(value.length - 2)}${value[value.length - 1]}`;
}
