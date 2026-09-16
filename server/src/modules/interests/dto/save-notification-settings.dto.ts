/**
 * The client sends the settings record itself ({ teamsMatching: { enabled } }),
 * whose keys are dynamic, so it cannot be a fixed-shape class DTO. The
 * controller receives the raw record and InterestsService validates the shape.
 */
export type SaveNotificationSettingsDto = Record<string, { enabled: boolean }>;
