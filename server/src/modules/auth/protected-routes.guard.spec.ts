import { describe, expect, it } from 'vitest';
import { AdsController } from '../ads/ads.controller.js';
import { BillingController } from '../billing/billing.controller.js';
import { BizController } from '../biz/biz.controller.js';
import { BookmarksController } from '../bookmarks/bookmarks.controller.js';
import { ChallengeBookmarksController } from '../bookmarks/challenge-bookmarks.controller.js';
import { InterestsController } from '../interests/interests.controller.js';
import { TeamsController } from '../teams/teams.controller.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// User-facing controllers below inject @CurrentUser(), which only JwtAuthGuard
// populates; the global MaintenanceGuard never touches request.user. Issue #58:
// these were reachable without authentication, so request.user was empty.
const protectedControllers: Array<[string, object]> = [
  ['AdsController', AdsController],
  ['BillingController', BillingController],
  ['BizController', BizController],
  ['BookmarksController', BookmarksController],
  ['ChallengeBookmarksController', ChallengeBookmarksController],
  ['InterestsController', InterestsController],
  ['TeamsController', TeamsController],
];

describe('user-facing controller guard wiring', () => {
  it.each(protectedControllers)(
    '%s applies JwtAuthGuard to the whole controller',
    (_name, controller) => {
      const guards = Reflect.getMetadata('__guards__', controller);
      expect(guards).toContain(JwtAuthGuard);
    },
  );
});
