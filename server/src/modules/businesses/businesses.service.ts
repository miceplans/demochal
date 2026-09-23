import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, users } from '../../db/schema.js';
import type { RegisterBusinessDto } from './dto/register-business.dto.js';
import type { UpdateBusinessDto } from './dto/update-business.dto.js';
import { verificationStatusPresentation } from '../verifications/verifications.service.js';

@Injectable()
export class BusinessesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async register(dto: RegisterBusinessDto, ownerUserId: string) {
    // One business per owner — findByOwner and the biz console assume it.
    if (await this.findByOwner(ownerUserId)) {
      throw new ConflictException('Business already registered for this user');
    }
    const business = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(businesses)
        .values({
          name: dto.name ?? null,
          registrationNumber: dto.registrationNumber ?? null,
          type: dto.type,
          ownerUserId,
        })
        .returning();
      // 기업을 등록한 일반 회원은 기업 회원이 된다(BizAccessCover가 role로 콘솔 접근을 판단).
      // 관리자 권한은 낮추지 않는다.
      await tx
        .update(users)
        .set({ role: 'business' })
        .where(and(eq(users.id, ownerUserId), eq(users.role, 'user')));
      return created;
    });
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
