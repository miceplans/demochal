import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApplicationsService } from './applications.service.js';
import { ApplyChallengeDto } from './dto/apply-challenge.dto.js';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  apply(@Body() dto: ApplyChallengeDto, @Headers('x-user-id') userId = '') {
    // TODO: replace header-based identification with an auth guard.
    return this.applicationsService.apply(dto, userId);
  }

  @Get('me')
  listMine(@Headers('x-user-id') userId = '') {
    return this.applicationsService.listForUser(userId);
  }
}
