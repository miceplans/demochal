const SCRIPT_INJECTION = /<\s*\/?\s*(?:script|iframe|object|embed|svg|math|style|link|meta|base|form)\b|\bon[a-z]+\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/i;
const SQL_INJECTION = /(?:'|\")\s*(?:or|and)\s+(?:'[^']*'|\d+|true|false)\s*=\s*(?:'[^']*'|\d+|true|false)|\bunion\s+(?:all\s+)?select\b|\b(?:drop|alter|truncate|create)\s+(?:table|database|schema)\b|;\s*(?:select|insert|update|delete|drop|alter|truncate|create)\b|(?:--|\/\*)/i;

export const hasUnsafeInput = (value: string) =>
  SCRIPT_INJECTION.test(value) || SQL_INJECTION.test(value);
