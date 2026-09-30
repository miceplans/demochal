import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { Public } from '../auth/public.decorator.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { InviteTeamDto } from './dto/invite-team.dto.js';
import { JoinTeamDto } from './dto/join-team.dto.js';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto.js';
import { TeamsService } from './teams.service.js';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Public()
  @Get()
  list(
    @Query('challengeId') challengeId?: string,
    @Query('role') role?: string,
    @Query('region') region?: string,
    @Query('q') q?: string,
  ) {
    return this.teamsService.list({ challengeId, role, region, q });
  }

  @Get('applications/me')
  listMyApplications(@CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.listMyApplications(user.id);
  }

  @Get('managed')
  listManaged(@CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.listManaged(user.id);
  }

  @Post()
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.create(dto, user);
  }

  @Get('offers/:memberId')
  getOffer(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.getOffer(memberId, user);
  }

  @Get(':id/scout-quota')
  getScoutQuota(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.getScoutQuota(id, user);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.findById(id);
  }

  @Post(':id/join')
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.join(id, dto.role, user.id);
  }

  @Post(':id/invite')
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.invite(id, dto, user);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.updateMember(id, memberId, dto, user);
  }
}
