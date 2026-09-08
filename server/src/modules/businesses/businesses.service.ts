import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses } from '../../db/schema.js';
import type { RegisterBusinessDto } from './dto/register-business.dto.js';

@Injectable()
export class BusinessesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // TODO: derive ownerUserId from the authenticated request once auth is implemented.
  async register(dto: RegisterBusinessDto, ownerUserId: string) {
    const [business] = await this.db
      .insert(businesses)
      .values({
        name: dto.name,
        registrationNumber: dto.registrationNumber,
        ownerUserId,
      })
      .returning();
    return business;
  }

  async findById(id: string) {
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }
}
