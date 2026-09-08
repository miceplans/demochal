import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessesService } from './businesses.service.js';
import { RegisterBusinessDto } from './dto/register-business.dto.js';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  register(@Body() dto: RegisterBusinessDto, @Req() req: Request) {
    // TODO: replace with req.user.id once an auth guard populates it.
    const ownerUserId = req.header('x-user-id') ?? '';
    return this.businessesService.register(dto, ownerUserId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessesService.findById(id);
  }
}
