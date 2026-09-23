import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { inputSecurityContext } from './input-security.context.js';

// This is a deliberately narrow deny-list.  It blocks payloads that can execute
// in a browser or alter the structure of a SQL statement, while allowing normal
// Korean/English prose, names, and punctuation.
const SCRIPT_INJECTION =
  /<\s*\/?\s*(?:script|iframe|object|embed|svg|math|style|link|meta|base|form)\b|\bon[a-z]+\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/i;
const SQL_INJECTION =
  /(?:'|")\s*(?:or|and)\s+(?:'[^']*'|\d+|true|false)\s*=\s*(?:'[^']*'|\d+|true|false)|\bunion\s+(?:all\s+)?select\b|\b(?:drop|alter|truncate|create)\s+(?:table|database|schema)\b|;\s*(?:select|insert|update|delete|drop|alter|truncate|create)\b|(?:--|\/\*)/i;

export function hasUnsafeInput(value: string): boolean {
  return SCRIPT_INJECTION.test(value) || SQL_INJECTION.test(value);
}

/**
 * Rejects hostile text before it reaches DTOs, services, logs, or the database.
 * Handlers annotated with `@SkipInputSecurity()` (opaque protocol parameters,
 * e.g. the Google OAuth callback) opt out per-handler via
 * `SkipInputSecurityInterceptor`; every other handler keeps this validation.
 */
@Injectable()
export class InputSecurityPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (inputSecurityContext.getStore()?.skipInputSecurity) return value;
    this.assertSafe(value);
    return value;
  }

  private assertSafe(value: unknown): void {
    if (typeof value === 'string') {
      if (hasUnsafeInput(value)) {
        throw new BadRequestException(
          '입력에 허용되지 않는 코드 또는 쿼리 구문이 포함되어 있습니다.',
        );
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => this.assertSafe(item));
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach((item) => this.assertSafe(item));
    }
  }
}
