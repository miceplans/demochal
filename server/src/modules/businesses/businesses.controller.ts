import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { BusinessesService } from './businesses.service.js';
import { RegisterBusinessDto } from './dto/register-business.dto.js';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  register(@Body() dto: RegisterBusinessDto, @Headers('x-user-id') ownerUserId: string | undefined) {
    // TODO: replace with the authenticated user id once an auth guard populates it.
    return this.businessesService.register(dto, ownerUserId ?? '');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessesService.findById(id);
  }
}
