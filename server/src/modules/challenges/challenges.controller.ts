import {
  BadRequestException,
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

const parseOptionalInt = (value: string | undefined, name: string) => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new BadRequestException(`${name} must be an integer`);
  return parsed;
};

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '20',
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('targets') targets?: string,
    @Query('organizerType') organizerType?: string,
    @Query('prizeMin') prizeMin?: string,
    @Query('prizeMax') prizeMax?: string,
    @Query('includeClosed') includeClosed?: string,
    @Query('sort') sort?: string,
  ) {
    return this.challengesService.list({
      cursor,
      limit: Number(limit),
      q,
      category,
      targets,
      organizerType,
      prizeMin: parseOptionalInt(prizeMin, 'prizeMin'),
      prizeMax: parseOptionalInt(prizeMax, 'prizeMax'),
      includeClosed: includeClosed !== 'false',
      sort,
    });
  }

  @Get('recommended')
  listRecommended(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.challengesService.listRecommended(user.id, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.challengesService.findById(id);
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard)
  findMine(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.challengesService.findMineById(id, user.id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.challengesService.getStats(id);
  }

  @Get('mine/:id/stats')
  @UseGuards(JwtAuthGuard)
  getMineStats(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.challengesService.getStatsForOwner(id, user.id);
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
