import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { SaveOnboardingSurveyDto } from './dto/save-onboarding-survey.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (id === user.id) return this.usersService.findById(id);
    return this.usersService.findPublicProfileById(id);
  }

  @Patch('me')
  updateMyProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Put('me/survey')
  saveOnboardingSurvey(
    @Body() dto: SaveOnboardingSurveyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.saveOnboardingSurvey(user.id, dto);
  }
}
