import { AsyncLocalStorage } from 'node:async_hooks';

export interface InputSecurityContextState {
  skipInputSecurity: boolean;
}

/**
 * Bridges the handler-level `@SkipInputSecurity()` metadata to the global
 * `InputSecurityPipe`. Pipes only receive argument metadata (no execution
 * context), so `SkipInputSecurityInterceptor` enters this store around the
 * handler execution and the pipe reads it while transforming arguments.
 */
export const inputSecurityContext = new AsyncLocalStorage<InputSecurityContextState>();
