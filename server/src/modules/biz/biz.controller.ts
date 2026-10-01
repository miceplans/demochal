import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { BizService } from './biz.service.js';

@Controller('biz')
export class BizController {
  constructor(private readonly bizService: BizService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.bizService.dashboard(user.id);
  }
}
