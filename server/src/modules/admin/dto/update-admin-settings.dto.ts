// The request body is `{ [key: string]: boolean }` (partial) — no fixed keys, so it isn't
// validated by class-validator here (see InterestsController's notification-settings for the
// same pattern/reasoning). AdminSettingsController types the @Body() param with this alias.
export type UpdateAdminSettingsDto = Record<string, boolean>;
