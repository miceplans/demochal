import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { inputSecurityContext } from './input-security.context.js';
import { SKIP_INPUT_SECURITY_KEY } from './skip-input-security.decorator.js';

/**
 * Enters the input-security opt-out context for handlers annotated with
 * `@SkipInputSecurity()` before their argument pipes run. Every other
 * handler keeps the default `InputSecurityPipe` validation untouched.
 */
@Injectable()
export class SkipInputSecurityInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_INPUT_SECURITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!skip) return next.handle();

    // Argument pipes execute inside `next.handle()`, so subscribing within
    // `AsyncLocalStorage.run` keeps the opt-out flag visible to them. The
    // teardown is returned so unsubscribing the outer subscription also
    // tears down the inner one.
    return new Observable<unknown>((subscriber) =>
      inputSecurityContext.run({ skipInputSecurity: true }, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
