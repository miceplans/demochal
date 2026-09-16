import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { BizService } from './biz.service.js';

@Controller('biz')
export class BizController {
  constructor(private readonly bizService: BizService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.bizService.dashboard(user.id);
  }
}
