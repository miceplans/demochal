import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ChallengesService } from './challenges.service.js';
import { CreateChallengeDto } from './dto/create-challenge.dto.js';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  list(@Query('cursor') cursor?: string, @Query('limit') limit = '20') {
    return this.challengesService.list(cursor, Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.challengesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateChallengeDto) {
    return this.challengesService.create(dto);
  }
}
