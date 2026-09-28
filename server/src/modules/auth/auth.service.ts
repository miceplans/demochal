import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { and, eq, ilike, isNull, or } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import {
  applications,
  bookmarks,
  businesses,
  files,
  notifications,
  teamMembers,
  teams,
  users,
} from '../../db/schema.js';
import { UsersService } from '../users/users.service.js';
import { ContactVerificationsService, normalizeContact } from './contact-verifications.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { WithdrawAccountDto } from './dto/withdraw-account.dto.js';

const PASSWORD_HASH_ROUNDS = 10;
const DUPLICATE_ACCOUNT_MESSAGE = 'Email or username already registered';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
// Compared against when the account doesn't exist (or has no password), so login
// spends the same bcrypt time either way and response latency doesn't reveal accounts.
const dummyPasswordHash = hash(randomBytes(32).toString('base64url'), PASSWORD_HASH_ROUNDS);
// pg unique_violation (see https://www.postgresql.org/docs/current/errcodes-appendix.html).
const POSTGRES_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly contactVerifications: ContactVerificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, name, username } = dto;
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        username
          ? or(eq(users.email, email), eq(users.username, username))
          : eq(users.email, email),
      )
      .limit(1);
    // One message for both collisions so signup can't be used to tell which of an
    // email/username pair exists.
    // TODO: 409 자체가 가입 여부를 드러낸다 — 이메일 인증 필수화 후에는 "인증 메일 발송"으로 통일한다.
    // https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-and-error-messages
    if (existing) throw new ConflictException(DUPLICATE_ACCOUNT_MESSAGE);

    const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);
    const now = new Date().toISOString();
    let user: typeof users.$inferSelect | undefined;
    try {
      user = await this.db.transaction(async (tx) => {
        const emailVerifiedAt = dto.emailVerificationId
          ? await this.contactVerifications.consume(tx, dto.emailVerificationId, 'email', email)
          : null;
        // TODO: 발송 relay가 붙으면 기업 가입에서 휴대폰/이메일 인증을 필수로 전환한다.
        const phoneVerifiedAt =
          dto.phoneVerificationId && dto.phone
            ? await this.contactVerifications.consume(
                tx,
                dto.phoneVerificationId,
                'phone',
                dto.phone,
              )
            : null;
        const [created] = await tx
          .insert(users)
          .values({
            email,
            name,
            passwordHash,
            username: username ?? null,
            phone: dto.phone ? normalizeContact('phone', dto.phone) : null,
            emailVerifiedAt,
            phoneVerifiedAt,
            termsAgreements: dto.agreements?.length
              ? Object.fromEntries(dto.agreements.map((key) => [key, now]))
              : null,
          })
          .returning();
        return created;
      });
    } catch (err) {
      // Lost a race against a concurrent signup for the same email/username.
      if (isUniqueViolation(err)) throw new ConflictException(DUPLICATE_ACCOUNT_MESSAGE);
      throw err;
    }
    if (!user) throw new Error('Failed to create user');

    const [accessToken, publicUser] = await Promise.all([
      this.issueToken(user),
      this.usersService.findById(user.id),
    ]);
    return { accessToken, user: publicUser };
  }

  /** `identifier` is an email, or a biz account's username when it has no `@`. */
  async login(identifier: string, password: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        identifier.includes('@')
          ? eq(users.email, identifier)
          : eq(users.username, identifier.toLowerCase()),
      )
      .limit(1);
    const passwordMatches = await compare(
      password,
      user?.passwordHash ?? (await dummyPasswordHash),
    );
    if (!user?.passwordHash || !passwordMatches || user.withdrawnAt) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.suspended) throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');

    const [accessToken, publicUser] = await Promise.all([
      this.issueToken(user),
      this.usersService.findById(user.id),
    ]);
    return { accessToken, user: publicUser };
  }

  /** Erases direct identifiers while preserving a non-personal FK anchor for content and orders. */
  async withdraw(userId: string, dto: WithdrawAccountDto) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.withdrawnAt || !user.passwordHash) {
      throw new UnauthorizedException('Account cannot be withdrawn');
    }
    if (!(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.db.transaction(async (tx) => {
      const leadingTeams = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.leaderUserId, userId));
      const transfers = new Map(
        dto.teamTransfers?.map((transfer) => [transfer.teamId, transfer.newLeaderUserId]),
      );
      if (leadingTeams.some((team) => !transfers.has(team.id))) {
        throw new BadRequestException(
          '모든 팀장 권한을 수락된 팀원에게 이전한 뒤 탈퇴할 수 있습니다.',
        );
      }
      for (const team of leadingTeams) {
        const newLeaderUserId = transfers.get(team.id)!;
        if (newLeaderUserId === userId)
          throw new BadRequestException('본인에게 권한을 이전할 수 없습니다.');
        const [member] = await tx
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .innerJoin(users, eq(teamMembers.userId, users.id))
          .where(
            and(
              eq(teamMembers.teamId, team.id),
              eq(teamMembers.userId, newLeaderUserId),
              eq(teamMembers.status, 'accepted'),
              isNull(users.withdrawnAt),
              eq(users.suspended, false),
            ),
          )
          .limit(1);
        if (!member) throw new BadRequestException('새 팀장은 수락된 활성 팀원이어야 합니다.');
        await tx.update(teams).set({ leaderUserId: newLeaderUserId }).where(eq(teams.id, team.id));
      }
      const ownedBusinesses = await tx
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.ownerUserId, userId));
      if (ownedBusinesses.length > 1) {
        throw new BadRequestException(
          '기관이 여러 개인 계정은 관리자에게 소유권 이전을 요청해 주세요.',
        );
      }
      const ownedBusiness = ownedBusinesses[0];
      if (ownedBusiness) {
        if (!dto.newBusinessOwnerUserId || dto.newBusinessOwnerUserId === userId) {
          throw new BadRequestException(
            '기관 소유권을 다른 활성 사용자에게 이전한 뒤 탈퇴할 수 있습니다.',
          );
        }
        const [newOwner] = await tx
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(
            and(
              eq(users.id, dto.newBusinessOwnerUserId),
              isNull(users.withdrawnAt),
              eq(users.suspended, false),
            ),
          )
          .limit(1);
        if (!newOwner) throw new BadRequestException('새 기관 소유자는 활성 사용자여야 합니다.');
        const [existingBusiness] = await tx
          .select({ id: businesses.id })
          .from(businesses)
          .where(eq(businesses.ownerUserId, newOwner.id))
          .limit(1);
        if (existingBusiness)
          throw new BadRequestException('새 기관 소유자는 이미 다른 기관을 소유하고 있습니다.');
        await tx
          .update(businesses)
          .set({ ownerUserId: newOwner.id })
          .where(eq(businesses.id, ownedBusiness.id));
        if (newOwner.role === 'user')
          await tx.update(users).set({ role: 'business' }).where(eq(users.id, newOwner.id));
      }
      await tx.delete(bookmarks).where(eq(bookmarks.userId, userId));
      await tx.delete(notifications).where(eq(notifications.userId, userId));
      await tx.delete(teamMembers).where(eq(teamMembers.userId, userId));
      await tx.delete(files).where(eq(files.uploaderUserId, userId));
      await tx
        .update(applications)
        .set({ teammates: [], formAnswers: [] })
        .where(eq(applications.userId, userId));
      await tx
        .update(users)
        .set({
          name: '탈퇴한 사용자',
          email: null,
          username: null,
          phone: null,
          passwordHash: null,
          googleSubject: null,
          naverSubject: null,
          position: null,
          region: null,
          stacks: [],
          badges: [],
          externalLinks: [],
          awardHistory: [],
          onboardingSurvey: null,
          interests: [],
          notificationSettings: {},
          termsAgreements: null,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          withdrawnAt: new Date(),
        })
        .where(eq(users.id, userId));
    });
  }

  /** Finds or creates the local account for a verified Google identity. */
  async loginWithGoogle(profile: { subject: string; email: string; name: string }) {
    const [byGoogleSubject] = await this.db
      .select()
      .from(users)
      .where(eq(users.googleSubject, profile.subject))
      .limit(1);

    let user = byGoogleSubject;
    if (!user) {
      const [byEmail] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, profile.email))
        .limit(1);
      if (byEmail) {
        // A verified Google email may be safely associated with the same local account.
        [user] = await this.db
          .update(users)
          .set({ googleSubject: profile.subject })
          .where(eq(users.id, byEmail.id))
          .returning();
      } else {
        const passwordHash = await hash(
          randomBytes(32).toString('base64url'),
          PASSWORD_HASH_ROUNDS,
        );
        [user] = await this.db
          .insert(users)
          .values({
            email: profile.email,
            name: profile.name.slice(0, 100) || profile.email.split('@')[0] || 'Google 사용자',
            passwordHash,
            googleSubject: profile.subject,
          })
          .returning();
      }
    }
    if (!user) throw new Error('Failed to create or link Google user');
    if (user.suspended) throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');

    const [accessToken, publicUser] = await Promise.all([
      this.issueToken(user),
      this.usersService.findById(user.id),
    ]);
    return { accessToken, user: publicUser };
  }

  /** Finds or creates the local account for a verified Naver identity. */
  async loginWithNaver(profile: { subject: string; email: string; name: string }) {
    const [byNaverSubject] = await this.db
      .select()
      .from(users)
      .where(eq(users.naverSubject, profile.subject))
      .limit(1);

    let user = byNaverSubject;
    if (!user) {
      // Case-insensitive: registration/login don't normalize stored email casing,
      // so an exact match here would miss an existing mixed-case account and
      // create a duplicate instead of linking the identity to it.
      const [byEmail] = await this.db
        .select()
        .from(users)
        .where(ilike(users.email, profile.email))
        .limit(1);
      if (byEmail) {
        // A verified Naver email may be safely associated with the same local account.
        [user] = await this.db
          .update(users)
          .set({ naverSubject: profile.subject })
          .where(eq(users.id, byEmail.id))
          .returning();
      } else {
        const passwordHash = await hash(
          randomBytes(32).toString('base64url'),
          PASSWORD_HASH_ROUNDS,
        );
        try {
          [user] = await this.db
            .insert(users)
            .values({
              email: profile.email,
              name: profile.name.slice(0, 100) || profile.email.split('@')[0] || 'Naver 사용자',
              passwordHash,
              naverSubject: profile.subject,
            })
            .returning();
        } catch (err) {
          // A concurrent callback for the same identity may have inserted first;
          // recover that row instead of failing this otherwise-valid login.
          if (!isUniqueViolation(err)) throw err;
          [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.naverSubject, profile.subject))
            .limit(1);
        }
      }
    }
    if (!user) throw new Error('Failed to create or link Naver user');
    if (user.suspended) throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');

    const [accessToken, publicUser] = await Promise.all([
      this.issueToken(user),
      this.usersService.findById(user.id),
    ]);
    return { accessToken, user: publicUser };
  }

  /** Finds or creates the local account for a Kakao identity with a verified email. */
  async loginWithKakao(profile: { subject: string; email: string; name: string }) {
    const [byKakaoSubject] = await this.db
      .select()
      .from(users)
      .where(eq(users.kakaoSubject, profile.subject))
      .limit(1);

    let user = byKakaoSubject;
    if (!user) {
      // Case-insensitive for the same reason as loginWithNaver.
      const [byEmail] = await this.db
        .select()
        .from(users)
        .where(ilike(users.email, profile.email))
        .limit(1);
      if (byEmail) {
        // Only verified Kakao emails reach here (see kakaoCallback), so linking is safe.
        [user] = await this.db
          .update(users)
          .set({ kakaoSubject: profile.subject })
          .where(eq(users.id, byEmail.id))
          .returning();
      } else {
        const passwordHash = await hash(
          randomBytes(32).toString('base64url'),
          PASSWORD_HASH_ROUNDS,
        );
        try {
          [user] = await this.db
            .insert(users)
            .values({
              email: profile.email,
              name: profile.name.slice(0, 100) || profile.email.split('@')[0] || 'Kakao 사용자',
              passwordHash,
              kakaoSubject: profile.subject,
            })
            .returning();
        } catch (err) {
          // A concurrent callback for the same identity may have inserted first.
          if (!isUniqueViolation(err)) throw err;
          [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.kakaoSubject, profile.subject))
            .limit(1);
        }
      }
    }
    if (!user) throw new Error('Failed to create or link Kakao user');
    if (user.suspended) throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');

    const [accessToken, publicUser] = await Promise.all([
      this.issueToken(user),
      this.usersService.findById(user.id),
    ]);
    return { accessToken, user: publicUser };
  }

  async me(token: string) {
    if (!token) throw new UnauthorizedException('Missing authentication cookie');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    let profile;
    try {
      profile = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('User no longer exists');
    }
    if (profile.suspended) {
      throw new ForbiddenException(profile.suspendedReason ?? '정지된 계정입니다.');
    }
    if (profile.withdrawnAt) throw new UnauthorizedException('User no longer exists');
    return profile;
  }

  private issueToken(user: typeof users.$inferSelect): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email ?? '', role: user.role };
    return this.jwtService.signAsync(payload);
  }
}
