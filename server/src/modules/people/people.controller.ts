import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { PeopleService } from './people.service.js';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('position') position?: string,
    @Query('region') region?: string,
    @Query('stack') stack?: string,
  ) {
    return this.peopleService.list({ q, sort, position, region, stack }, user.id);
  }
}
