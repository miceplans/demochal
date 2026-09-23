import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { ChallengesService } from './challenges.service.js';
import { CreateChallengeDto } from './dto/create-challenge.dto.js';
import { UpdateChallengeDto } from './dto/update-challenge.dto.js';
import { UpdateChallengeStatusDto } from './dto/update-challenge-status.dto.js';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  list(@Query('cursor') cursor?: string, @Query('limit') limit = '20') {
    return this.challengesService.list(cursor, Number(limit));
  }

  @Get('recommended')
  listRecommended(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.challengesService.listRecommended(user.id, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.challengesService.findById(id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.challengesService.getStats(id);
  }

  @Get(':id/similar')
  listSimilar(@Param('id') id: string) {
    return this.challengesService.listSimilar(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateChallengeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.challengesService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChallengeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.challengesService.update(id, dto, user);
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
