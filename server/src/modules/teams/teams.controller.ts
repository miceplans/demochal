import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { TeamsService } from './teams.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { JoinTeamDto } from './dto/join-team.dto.js';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto.js';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list(
    @Query('challengeId') challengeId?: string,
    @Query('role') role?: string,
    @Query('region') region?: string,
    @Query('q') q?: string,
  ) {
    return this.teamsService.list({ challengeId, role, region, q });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.create(dto, user.id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  join(@Param('id') id: string, @Body() dto: JoinTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.join(id, dto, user.id);
  }

  @Patch(':id/members/:memberId')
  @UseGuards(JwtAuthGuard)
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.updateMember(id, memberId, dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findById(id);
  }
}
