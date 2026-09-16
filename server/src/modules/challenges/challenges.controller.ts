import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { Public } from '../../common/auth/public.decorator.js';
import { ChallengesService } from './challenges.service.js';
import { CreateChallengeDto } from './dto/create-challenge.dto.js';
import { UpdateChallengeStatusDto } from './dto/update-challenge-status.dto.js';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Public()
  @Get()
  list(@Query('cursor') cursor?: string, @Query('limit') limit = '20') {
    return this.challengesService.list(cursor, Number(limit));
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.challengesService.findById(id);
  }

  @Public()
  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.challengesService.getStats(id);
  }

  @Public()
  @Get(':id/similar')
  listSimilar(@Param('id') id: string) {
    return this.challengesService.listSimilar(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateChallengeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.challengesService.create(dto, user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateChallengeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.challengesService.updateStatus(id, dto, user.id);
  }
}
