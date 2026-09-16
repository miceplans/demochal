import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given account roles (e.g. @Roles('admin')). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
