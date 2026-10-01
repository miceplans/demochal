import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks an endpoint as reachable without the HttpOnly-cookie session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Overrides a controller-level Public marker for endpoints that need a session. */
export const Authenticated = () => SetMetadata(IS_PUBLIC_KEY, false);
