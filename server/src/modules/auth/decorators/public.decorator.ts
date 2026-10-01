import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks an endpoint as reachable without the HttpOnly-cookie session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
