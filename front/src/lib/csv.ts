// Excel이 수식으로 해석하는 선행 문자. 사용자 입력(신고 내용 등)이 그대로 셀에 들어가므로
// 앞에 작은따옴표를 붙여 텍스트로 고정한다 (CSV injection 방지).
// https://owasp.org/www-community/attacks/CSV_Injection
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: string) {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** 헤더 + 행을 UTF-8 BOM CSV(Excel 호환)로 만들어 브라우저 다운로드를 트리거한다. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
