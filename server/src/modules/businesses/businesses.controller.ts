import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BusinessesService } from './businesses.service.js';
import { RegisterBusinessDto } from './dto/register-business.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('me/challenges')
  @UseGuards(JwtAuthGuard)
  listMyChallenges(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = '20',
  ) {
    return this.businessesService.listMyChallenges(user.id, cursor, Number(limit));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.findByOwnerOrThrow(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  register(@Body() dto: RegisterBusinessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.register(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessesService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessesService.update(id, dto, user.id);
  }
}
