import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, challenges, users } from '../../db/schema.js';
import { AdminAlertsService } from '../admin/admin-alerts.service.js';
import type { RegisterBusinessDto } from './dto/register-business.dto.js';
import type { UpdateBusinessDto } from './dto/update-business.dto.js';
import { verificationStatusPresentation } from './business-status.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { FilesService } from '../files/files.service.js';
import { NtsClient } from '../verifications/clients/nts.client.js';

const LIST_MAX_LIMIT = 100;

@Injectable()
export class BusinessesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly adminAlerts: AdminAlertsService,
    private readonly filesService: FilesService,
    private readonly ntsClient: NtsClient,
  ) {}

  async register(dto: RegisterBusinessDto, ownerUserId: string) {
    // One business per owner — findByOwner and the biz console assume it.
    if (await this.findByOwner(ownerUserId)) {
      throw new ConflictException('이미 등록된 기업 정보가 있습니다.');
    }
    let registrationLookupUnavailable = false;
    // 국세청 조회 결과 — 기업 유형만 조회하며, 관리자 콘솔 NTS 컬럼이 이 값을 쓴다.
    let ntsResult: 'registered' | 'unavailable' | null = null;
    if (dto.type === '기업') {
      if (!dto.registrationNumber || !/^\d{10}$/.test(dto.registrationNumber)) {
        throw new BadRequestException('사업자등록번호 10자리를 입력해주세요.');
      }
      // Provider failures are distinct from a confirmed unregistered number.
      let result: 'registered' | 'unregistered' | undefined;
      try {
        result = await this.ntsClient.lookupRegistration(dto.registrationNumber);
      } catch {
        // 가입 정책에 따라 조회 장애 시 등록을 허용한다.
        registrationLookupUnavailable = true;
        ntsResult = 'unavailable';
      }
      if (result === 'unregistered') {
        throw new BadRequestException('국세청에 등록되지 않은 사업자등록번호입니다.');
      }
      if (result === 'registered') ntsResult = 'registered';
    }
    const business = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(businesses)
        .values({
          name: dto.name ?? null,
          registrationNumber: dto.registrationNumber ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          type: dto.type,
          ownerUserId,
          // 기관 가입은 서류 심사 없이 자동 승인한다.
          verificationStatus: 'verified',
          ntsResult,
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
    // 기관명/사업자번호는 알림에 싣지 않는다(개인정보 최소화) — id만 전달한다.
    await this.adminAlerts.notify('newBusinessAlert', 'admin.business', {
      businessId: business!.id,
    });
    return {
      ...business!,
      ...verificationStatusPresentation(business!.verificationStatus),
      registrationLookupUnavailable,
    };
  }

  // 사업자번호·주소·연락처 등 민감 필드를 담은 전체 행이므로 소유자나 관리자만 볼 수 있다.
  async findById(id: string, user: AuthenticatedUser) {
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    if (!business) throw new NotFoundException('기업 정보를 찾을 수 없습니다.');
    if (business.ownerUserId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('기업 정보 조회 권한이 없습니다.');
    }
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
    if (!business) throw new ForbiddenException('기업 계정이 필요합니다.');
    return business;
  }

  async listMyChallenges(ownerUserId: string, cursor?: string, limit = 20) {
    // LIMIT·slice·hasMore가 모두 같은 clamped 값을 써야 한다 — SQL만 clamp하고
    // slice/hasMore는 검증 안 된 원본 limit을 쓰면 페이지 크기가 어긋난다.
    const pageSize = Math.min(
      Math.max(Number.isFinite(limit) ? Math.floor(limit) : 20, 1),
      LIST_MAX_LIMIT,
    );
    let before: Date | undefined;
    if (cursor !== undefined) {
      const parsed = new Date(cursor);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('유효하지 않은 커서입니다.');
      }
      before = parsed;
    }
    const where = before ? lt(challenges.createdAt, before) : undefined;
    const rows = await this.db
      .select({ challenge: challenges })
      .from(challenges)
      .innerJoin(businesses, eq(businesses.id, challenges.businessId))
      .where(and(eq(businesses.ownerUserId, ownerUserId), where))
      .orderBy(desc(challenges.createdAt))
      .limit(pageSize + 1);
    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map(({ challenge }) => challenge);
    const posterUrls = await this.filesService.resolvePublicUrls(
      items.map((item) => item.posterFileId),
    );
    return {
      items: items.map((item) => ({
        ...item,
        posterUrl: item.posterFileId ? (posterUrls.get(item.posterFileId) ?? null) : null,
      })),
      nextCursor: hasMore ? (items.at(-1)?.createdAt.toISOString() ?? null) : null,
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
    if (!business) throw new NotFoundException('기업 정보를 찾을 수 없거나 조회 권한이 없습니다.');
    return { ...business, ...verificationStatusPresentation(business.verificationStatus) };
  }
}
