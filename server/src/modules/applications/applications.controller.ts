import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { ApplicationsService } from './applications.service.js';
import { ApplyChallengeDto } from './dto/apply-challenge.dto.js';
import { UpdateApplicationDto } from './dto/update-application.dto.js';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  apply(@Body() dto: ApplyChallengeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.apply(dto, user.id);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.listForUser(user.id);
  }

  @Get('managed')
  listManaged(
    @CurrentUser() user: AuthenticatedUser,
    @Query('challengeId') challengeId?: string,
    @Query('status') status?: string,
  ) {
    return this.applicationsService.listForBusinessOwner(user.id, { challengeId, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.findById(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applicationsService.update(id, dto, user.id);
  }
}
