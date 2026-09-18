import { env } from '../../config/env.js';
import type { files } from '../../db/schema.js';

// Ready public files are served through CloudFront, never returned as a bare
// object key — callers (frontend, other services) shouldn't need to know the
// bucket/CDN layout to render an image. Anything not public+ready (including
// every private file) resolves to null; private objects stay
// presigned-GET-only per CLAUDE.md's private-bucket rule. Shared between
// files.service.ts and ads.service.ts so both build the URL the same way.
export function buildPublicFileUrl(
  file: Pick<typeof files.$inferSelect, 'bucket' | 'uploadStatus' | 'key'>,
): string | null {
  return file.bucket === 'public' && file.uploadStatus === 'ready' && env.publicAssetsBaseUrl
    ? `${env.publicAssetsBaseUrl}/${file.key}`
    : null;
}
