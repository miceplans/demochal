import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, or, sql, ilike } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, certificates, files, users, verifications } from '../../db/schema.js';
import { FilesService } from '../files/files.service.js';
import { buildPublicFileUrl } from '../files/public-file-url.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ReviewPortfolioBadgeDto } from './dto/review-portfolio-badge.dto.js';
import type { VerifyCertificateDto } from './dto/verify-certificate.dto.js';
import { countRows, formatMonthDay, like, maskBizNumber } from './admin.utils.js';
import type { AdminStatCard } from './admin.service.js';

type PortfolioLink = { label?: string; url?: string; portfolioBadge?: 'pending' | 'approved' };

@Injectable()
export class AdminVerificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
    private readonly filesService: FilesService,
  ) {}

  // --------------------------------------------------------------- businesses

  async listBusinesses(q?: string, type?: string, status?: string) {
    const [totalRow] = await this.db.select({ count: countRows }).from(businesses);
    const [approvedRow] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'verified'));
    const [rejectedRow] = await this.db
      .select({ count: countRows })
      .from(businesses)
      .where(eq(businesses.verificationStatus, 'rejected'));

    const conditions = [];
    // 검색창이 "기관명/담당자"이므로 기관 소유자(담당자) 이름도 함께 매칭한다.
    if (q) {
      conditions.push(
        or(
          ilike(businesses.name, like(q)),
          sql`${businesses.ownerUserId} in (select ${users.id} from ${users} where ${users.name} ilike ${like(q)})`,
        ),
      );
    }
    if (status) conditions.push(eq(businesses.verificationStatus, status));
    if (type) conditions.push(eq(businesses.type, type));
    const rows = await this.db
      .select()
      .from(businesses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(businesses.createdAt));

    const businessIds = rows.map((row) => row.id);
    const verificationRows = businessIds.length
      ? await this.db
          .select()
          .from(verifications)
          .where(inArray(verifications.businessId, businessIds))
          .orderBy(desc(verifications.createdAt))
      : [];

    // First occurrence per business is the latest verification (desc order).
    const latestByBusiness = new Map<string, (typeof verificationRows)[number]>();
    const allByBusiness = new Map<string, (typeof verificationRows)[number][]>();
    for (const row of verificationRows) {
      if (!latestByBusiness.has(row.businessId)) latestByBusiness.set(row.businessId, row);
      const list = allByBusiness.get(row.businessId) ?? [];
      list.push(row);
      allByBusiness.set(row.businessId, list);
    }

    const stats: AdminStatCard[] = [
      { label: '전체 신청', value: String(totalRow?.count ?? 0), meta: '전체', dot: '#006FFF' },
      { label: '승인', value: String(approvedRow?.count ?? 0), meta: '누적 승인', dot: '#22C55E' },
      { label: '거부', value: String(rejectedRow?.count ?? 0), meta: '누적 거부', dot: '#FF4D00' },
    ];

    const items = rows.map((business) => {
      const businessVerifications = allByBusiness.get(business.id) ?? [];
      const latest = latestByBusiness.get(business.id);
      // Closed-business OCR markers take precedence over raw status so a 폐업/
      // 휴업 row surfaces as 'closed' rather than a generic 'failed'.
      const ocrDump = businessVerifications
        .map((row) => JSON.stringify(row.ocrResult ?? {}))
        .join('');
      const nts =
        ocrDump.includes('폐업자') || ocrDump.includes('휴업자')
          ? 'closed'
          : businessVerifications.some((row) => row.status === 'verified')
            ? 'success'
            : businessVerifications.some((row) => row.status === 'rejected')
              ? 'failed'
              : business.ntsResult === 'registered'
                ? 'success'
                : 'unrecognized';
      const appliedAt = latest?.createdAt ?? business.createdAt;
      return {
        id: business.id,
        // 승인/거부 API는 인증 요청 id를 받는다 — 기관 id가 아니라 최신 요청을 넘긴다.
        verificationId: latest?.id ?? null,
        org: business.name ?? '기관명 미등록',
        // Businesses registered before the type column existed have no value.
        type: business.type ?? '미지정',
        // 학교/비영리 등은 사업자번호가 없다.
        bizNumber: business.registrationNumber ? maskBizNumber(business.registrationNumber) : '-',
        appliedAt: formatMonthDay(appliedAt),
        nts,
        status: business.verificationStatus,
      };
    });

    return { stats, items };
  }

  // ------------------------------------------------------------- verification

  async approveVerification(id: string) {
    return this.setVerificationResult(id, 'verified', null);
  }

  async rejectVerification(id: string, reason: string) {
    return this.setVerificationResult(id, 'rejected', reason);
  }

  private async setVerificationResult(
    id: string,
    status: 'verified' | 'rejected',
    reason: string | null,
  ) {
    // 조회·상태 전이·기관 상태 갱신·결과 알림을 한 트랜잭션에서 처리한다(행 잠금).
    const updated = await this.db.transaction(async (tx) => {
      const [verification] = await tx
        .select()
        .from(verifications)
        .where(eq(verifications.id, id))
        .for('update')
        .limit(1);
      if (!verification) throw new NotFoundException('인증 요청을 찾을 수 없습니다.');
      if (verification.status === status) {
        throw new ConflictException(`이미 ${status} 상태의 인증 요청입니다.`);
      }

      const [row] = await tx
        .update(verifications)
        .set({
          status,
          rejectionReason: status === 'rejected' ? reason : null,
          updatedAt: new Date(),
        })
        .where(eq(verifications.id, id))
        .returning();

      const [business] = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.id, verification.businessId))
        .limit(1);
      if (business) {
        await tx
          .update(businesses)
          .set({ verificationStatus: status })
          .where(
            and(
              eq(businesses.id, business.id),
              // 더 최근 인증 요청이 있으면 이 처리가 기관의 현재 상태를 덮어쓰지 않는다.
              sql`not exists (select 1 from ${verifications} where ${verifications.businessId} = ${business.id} and ${verifications.createdAt} > ${verification.createdAt})`,
            ),
          );
      }
      if (business?.ownerUserId) {
        await this.notificationsService.create(
          business.ownerUserId,
          'verification.result',
          { verificationId: id, status, ...(reason ? { reason } : {}) },
          tx,
        );
      }
      return row;
    });

    return updated;
  }

  // ------------------------------------------------------------- certificates

  async listCertificates(status?: string, q?: string, category?: string) {
    const conditions = [];
    if (status) conditions.push(eq(certificates.status, status));
    if (category) conditions.push(eq(certificates.category, category));
    if (q) {
      conditions.push(or(ilike(certificates.title, like(q)), ilike(users.name, like(q))));
    }
    const rows = await this.db
      .select({ certificate: certificates, userName: users.name, file: files })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .leftJoin(files, eq(certificates.fileId, files.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(certificates.createdAt));

    // 첫 파일은 위 조인으로 이미 읽었으므로 나머지 파일만 한 번에 조회한다.
    const extraIds = [
      ...new Set(
        rows.flatMap(({ certificate }) =>
          certificate.fileIds.filter((fileId) => fileId !== certificate.fileId),
        ),
      ),
    ];
    const extraFiles = extraIds.length
      ? await this.db.select().from(files).where(inArray(files.id, extraIds))
      : [];
    const extraById = new Map(extraFiles.map((extra) => [extra.id, extra]));

    return Promise.all(
      rows.map(async ({ certificate, userName, file }) => {
        const primary = await this.certificateFile(file);
        const rest = await Promise.all(
          certificate.fileIds
            .filter((fileId) => fileId !== certificate.fileId)
            .map(async (fileId) => ({
              fileId,
              ...(await this.certificateFile(extraById.get(fileId) ?? null)),
            })),
        );
        return {
          id: certificate.id,
          user: userName,
          award: certificate.title,
          category: certificate.category,
          fileId: certificate.fileId,
          ...primary,
          files: [{ fileId: certificate.fileId, ...primary }, ...rest],
          status: certificate.status,
        };
      }),
    );
  }

  /**
   * Viewable URL for a certificate's original. Public files use the CDN URL;
   * private ones get a 5-minute presigned GET (never a public link) per the
   * private-bucket rule. Unfinished/rejected uploads have nothing to show.
   */
  private async certificateFile(file: typeof files.$inferSelect | null) {
    if (!file || file.uploadStatus !== 'ready') return { fileUrl: null, fileContentType: null };
    const fileUrl =
      file.bucket === 'private'
        ? await this.filesService.getPrivateReadUrl(file.key)
        : buildPublicFileUrl(file);
    return { fileUrl, fileContentType: file.contentType };
  }

  async verifyCertificate(id: string, dto: VerifyCertificateDto) {
    const reason = dto.reason?.trim();
    if (dto.action === 'reject' && !reason) {
      throw new BadRequestException('A rejection reason is required');
    }
    const [certificate] = await this.db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id))
      .limit(1);
    if (!certificate) throw new NotFoundException('인증서를 찾을 수 없습니다.');

    const status = dto.action === 'approve' ? 'verified' : 'rejected';
    if (certificate.status === status) {
      throw new ConflictException(`이미 ${status} 상태의 인증서입니다.`);
    }
    // 상태 전이와 뱃지 부여/회수는 한 트랜잭션으로 처리해 서로 어긋나지 않게 한다.
    const { updated, owner } = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(certificates)
        .set({
          status,
          rejectionReason: dto.action === 'reject' ? (reason ?? null) : null,
        })
        .where(eq(certificates.id, id))
        .returning();

      const [certificateOwner] = await tx
        .select()
        .from(users)
        .where(eq(users.id, certificate.userId))
        .limit(1);

      if (dto.action === 'approve' && certificateOwner) {
        // read-modify-write 대신 단일 UPDATE로 원자적으로 중복 없이 추가한다.
        await tx
          .update(users)
          .set({
            badges: sql`case when ${users.badges} @> jsonb_build_array(${certificate.title}::text)
            then ${users.badges}
            else ${users.badges} || jsonb_build_array(${certificate.title}::text) end`,
          })
          .where(eq(users.id, certificateOwner.id));
      } else if (dto.action === 'reject' && certificate.status === 'verified' && certificateOwner) {
        // 승인했던 인증서를 거부로 뒤집으면 그 인증서로 받은 뱃지를 회수한다
        // (같은 제목의 다른 인증 완료 인증서가 있으면 유지).
        await tx
          .update(users)
          .set({
            badges: sql`case when exists (
              select 1 from ${certificates}
              where ${certificates.userId} = ${certificateOwner.id}
                and ${certificates.title} = ${certificate.title}
                and ${certificates.status} = 'verified'
                and ${certificates.id} <> ${id}
            ) then ${users.badges} else ${users.badges} - ${certificate.title}::text end`,
          })
          .where(eq(users.id, certificateOwner.id));
      }
      return { updated: row, owner: certificateOwner };
    });

    return {
      id: updated!.id,
      user: owner?.name ?? '',
      award: updated!.title,
      category: updated!.category,
      fileId: updated!.fileId,
      status: updated!.status,
    };
  }

  // ------------------------------------------------------- portfolio badges

  /** 포트폴리오 뱃지 신청 중(pending)인 링크를 사용자별로 풀어 최신 가입 순으로 돌려준다. */
  async listPortfolioBadgeRequests() {
    const rows = await this.db
      .select({ id: users.id, name: users.name, externalLinks: users.externalLinks })
      .from(users)
      .where(
        sql`jsonb_path_exists(${users.externalLinks}, '$[*] ? (@.portfolioBadge == "pending")')`,
      )
      .orderBy(desc(users.createdAt), desc(users.id));
    return rows.flatMap((row) =>
      (Array.isArray(row.externalLinks) ? (row.externalLinks as PortfolioLink[]) : [])
        .filter((link) => link.portfolioBadge === 'pending')
        .map((link) => ({
          id: `${row.id}:${link.url ?? ''}`,
          userId: row.id,
          userName: row.name,
          label: link.label ?? '',
          url: link.url ?? '',
        })),
    );
  }

  /** 승인하면 다른 사용자에게도 뱃지가 노출되고, 거부하면 신청 표시만 지운다(링크는 유지). */
  async reviewPortfolioBadge(userId: string, dto: ReviewPortfolioBadgeDto) {
    // 같은 사용자의 프로필 저장·다른 승인 처리와 겹쳐 갱신이 유실되지 않도록 행을 잠그고 읽는다.
    await this.db.transaction(async (tx) => {
      const [target] = await tx
        .select({ externalLinks: users.externalLinks })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for('update');
      if (!target) throw new NotFoundException('사용자를 찾을 수 없습니다.');
      const links = (
        Array.isArray(target.externalLinks) ? target.externalLinks : []
      ) as PortfolioLink[];
      if (!links.some((link) => link.url === dto.url && link.portfolioBadge === 'pending')) {
        throw new ConflictException('신청 중인 포트폴리오 뱃지가 아닙니다.');
      }
      const next = links.map((link) => {
        if (link.url !== dto.url || link.portfolioBadge !== 'pending') return link;
        const { portfolioBadge: _pending, ...rest } = link;
        return dto.action === 'approve' ? { ...rest, portfolioBadge: 'approved' } : rest;
      });
      await tx.update(users).set({ externalLinks: next }).where(eq(users.id, userId));
    });
    return { userId, url: dto.url, status: dto.action === 'approve' ? 'approved' : 'rejected' };
  }
}
