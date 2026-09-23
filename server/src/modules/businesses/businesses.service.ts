import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, challenges } from '../../db/schema.js';
import type { RegisterBusinessDto } from './dto/register-business.dto.js';
import type { UpdateBusinessDto } from './dto/update-business.dto.js';
import { verificationStatusPresentation } from '../verifications/verifications.service.js';

@Injectable()
export class BusinessesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async register(dto: RegisterBusinessDto, ownerUserId: string) {
    const [business] = await this.db
      .insert(businesses)
      .values({
        name: dto.name,
        registrationNumber: dto.registrationNumber,
        type: dto.type,
        ownerUserId,
      })
      .returning();
    return { ...business!, ...verificationStatusPresentation(business!.verificationStatus) };
  }

  async findById(id: string) {
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    if (!business) throw new NotFoundException('Business not found');
    return { ...business, ...verificationStatusPresentation(business.verificationStatus) };
  }

  async findByOwner(ownerUserId: string) {
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, ownerUserId))
      .limit(1);
    return business
      ? { ...business, ...verificationStatusPresentation(business.verificationStatus) }
      : null;
  }

  async findByOwnerOrThrow(ownerUserId: string) {
    const business = await this.findByOwner(ownerUserId);
    if (!business) throw new ForbiddenException('Business account required');
    return business;
  }

  async listMyChallenges(ownerUserId: string, cursor?: string, limit = 20) {
    const pageSize = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 20;
    const cursorParts = cursor?.split('|');
    const cursorDate = cursorParts?.[0] ? new Date(cursorParts[0]) : undefined;
    if (cursorDate && !Number.isFinite(cursorDate.getTime()))
      throw new BadRequestException('Invalid cursor');
    const where = cursorDate
      ? cursorParts?.[1]
        ? or(
            lt(challenges.createdAt, cursorDate),
            and(eq(challenges.createdAt, cursorDate), lt(challenges.id, cursorParts[1])),
          )
        : lt(challenges.createdAt, cursorDate)
      : undefined;
    const rows = await this.db
      .select({ challenge: challenges })
      .from(challenges)
      .innerJoin(businesses, eq(businesses.id, challenges.businessId))
      .where(and(eq(businesses.ownerUserId, ownerUserId), where))
      .orderBy(desc(challenges.createdAt), desc(challenges.id))
      .limit(pageSize + 1);
    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map(({ challenge }) => challenge);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  async update(id: string, dto: UpdateBusinessDto, ownerUserId: string) {
    const [business] = await this.db
      .update(businesses)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.bannerImageFileId !== undefined && { bannerImageFileId: dto.bannerImageFileId }),
        ...(dto.logoImageFileId !== undefined && { logoImageFileId: dto.logoImageFileId }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.contentBlocks !== undefined && { contentBlocks: dto.contentBlocks }),
      })
      .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, ownerUserId)))
      .returning();
    if (!business) throw new NotFoundException('Business not found or not owned by user');
    return { ...business, ...verificationStatusPresentation(business.verificationStatus) };
  }
}
