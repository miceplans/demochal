import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { Public } from '../../common/auth/public.decorator.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
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

  @Post()
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.create(dto, user.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findById(id);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @Body() dto: JoinTeamDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.join(id, dto.role, user.id);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.teamsService.updateMember(id, memberId, dto, user);
  }
}
