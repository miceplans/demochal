import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import { UsersService } from '../users/users.service.js';

const PASSWORD_HASH_ROUNDS = 10;

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
  ) {}

  async register(email: string, password: string, name: string) {
    const [existing] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);
    const [user] = await this.db.insert(users).values({ email, name, passwordHash }).returning();
    if (!user) throw new Error('Failed to create user');

    const [accessToken, publicUser] = await Promise.all([
      this.issueToken(user),
      this.usersService.findById(user.id),
    ]);
    return { accessToken, user: publicUser };
  }

  async login(email: string, password: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid email or password');

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Invalid email or password');

    if (user.status === 'suspended')
      throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');

    const [accessToken, publicUser] = await Promise.all([
      this.issueToken(user),
      this.usersService.findById(user.id),
    ]);
    return { accessToken, user: publicUser };
  }

  /** Finds or creates the local account for a verified Google identity. */
  async loginWithGoogle(profile: { subject: string; email: string; name: string }) {
    const [byGoogleSubject] = await this.db
      .select()
      .from(users)
      .where(eq(users.googleId, profile.subject))
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
          .set({ googleId: profile.subject })
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
            authProvider: 'google',
            googleId: profile.subject,
          })
          .returning();
      }
    }
    if (!user) throw new Error('Failed to create or link Google user');
    if (user.status === 'suspended')
      throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');

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
    if (profile.status === 'suspended') {
      throw new ForbiddenException(profile.suspendedReason ?? '정지된 계정입니다.');
    }
    return profile;
  }

  private issueToken(user: typeof users.$inferSelect): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }
}
