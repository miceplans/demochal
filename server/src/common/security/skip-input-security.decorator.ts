import { SetMetadata } from '@nestjs/common';

export const SKIP_INPUT_SECURITY_KEY = 'skipInputSecurity';

/**
 * Opts a single handler out of the global `InputSecurityPipe`.
 *
 * Reserve this for handlers whose arguments are opaque, provider-issued
 * protocol parameters (e.g. OAuth callback `code`/`state` tokens) whose
 * URL-safe alphabet can legitimately contain deny-list sequences such as
 * `--`. Such handlers must keep their own validation controls (signed state
 * comparison, HTTPS token exchange) because the generic input-security
 * deny-list no longer inspects their arguments.
 */
export const SkipInputSecurity = () => SetMetadata(SKIP_INPUT_SECURITY_KEY, true);
